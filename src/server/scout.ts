/**
 * The AI scout: refreshes deals and events for Bellingham by having Claude
 * search the web, then converting its notes into rows.
 *
 * Two calls per target:
 *   1. Research — Claude Opus 5.5 with the server-side web search tool reads
 *      venue sites, event calendars and local press and writes structured
 *      notes. Streams (long-running) and resumes `pause_turn`.
 *   2. Extract — a second, cheaper call turns those notes into JSON that
 *      matches `ScoutResultSchema` (structured outputs), which we upsert.
 *
 * Nothing is ever deleted: new rows are added, matching rows are refreshed
 * and stamped `lastVerifiedAt`. Rows the scout didn't mention are left as-is.
 *
 * Run from the cron routes (`/api/cron/scout/<target>`), the admin page, or
 * `npm run scout -- <target>`.
 */
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { prisma } from "./db";
import type { ActivityCategory, ScoutTarget, Weekday } from "~/generated/prisma/enums";
import { ACTIVITY_CATEGORIES } from "~/lib/categories";
import { addDays, todayIso, WEEKDAYS } from "~/lib/dates";
import { slugify } from "~/lib/utils";

export const SCOUT_MODEL = "claude-opus-5-5";

// ---------------------------------------------------------------------------
// Output schema (structured outputs). Every field is required; use null for
// unknowns so the model never has to decide whether to omit a key.
// ---------------------------------------------------------------------------

const WeekdaySchema = z.enum(WEEKDAYS);
const CategorySchema = z.enum(ACTIVITY_CATEGORIES);
const ConfidenceSchema = z.enum(["HIGH", "MEDIUM", "LOW"]);
const HHMM = z
  .string()
  .regex(/^\d{2}:\d{2}$/)
  .nullable()
  .describe('24h "HH:MM" local time, or null');
const IsoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable()
  .describe('"YYYY-MM-DD" or null');

const VenueSchema = z.object({
  name: z.string(),
  type: z.enum(["RESTAURANT", "GROCERY", "ACTIVITY"]),
  category: CategorySchema.nullable().describe("Activity venues only"),
  cuisine: z.string().nullable(),
  address: z.string().nullable().describe("Street address with city, state, zip"),
  neighborhood: z
    .string()
    .nullable()
    .describe(
      "One of: Downtown, Fairhaven, Old Town, Sunnyland, Lettered Streets, Sehome, Samish, Roosevelt, Barkley, Cordata, Meridian, Columbia, Lakeway, Squalicum Harbor, Birchwood, Happy Valley, York",
    ),
  website: z.string().nullable(),
  weeklyAdUrl: z.string().nullable().describe("Grocery stores: link to the weekly ad"),
  description: z.string().nullable(),
});

const DealSchema = z.object({
  venue: z.string().describe("Must match a venue name in `venues`"),
  title: z.string(),
  description: z.string().nullable(),
  days: z.array(WeekdaySchema).describe("Empty array means every day"),
  startTime: HHMM,
  endTime: HHMM,
  priceText: z.string().nullable(),
  validFrom: IsoDateSchema.describe("Dated offers (weekly ads) only"),
  validTo: IsoDateSchema,
  sourceUrl: z.string().nullable(),
  confidence: ConfidenceSchema,
});

const EventSchema = z.object({
  venue: z.string().describe("Must match a venue name in `venues`"),
  category: CategorySchema,
  title: z.string(),
  description: z.string().nullable(),
  recurring: z.boolean().describe("true = weekly on `days`; false = one-off on `date`"),
  days: z.array(WeekdaySchema),
  date: IsoDateSchema,
  startTime: HHMM,
  endTime: HHMM,
  priceText: z.string().nullable(),
  sourceUrl: z.string().nullable(),
  confidence: ConfidenceSchema,
});

export const ScoutResultSchema = z.object({
  venues: z.array(VenueSchema),
  deals: z.array(DealSchema),
  events: z.array(EventSchema),
  closedVenues: z
    .array(z.string())
    .describe("Names of venues from the known list that are confirmed permanently closed"),
  summary: z.string().describe("Two or three sentences on what changed"),
});
export type ScoutResult = z.infer<typeof ScoutResultSchema>;

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

const SYSTEM = `You are a local researcher for "Thoughts on Dinner", an app that lists weekly food specials and date-night activities in Bellingham, Washington (including the Fairhaven neighborhood). Everything you report is shown to real people deciding where to go tonight, so accuracy beats volume.

Rules:
- Only report things you found on a web page during this session: a venue's own site or social post, a local calendar (bellingham.org, downtownbellingham.com, Cascadia Daily News, Whatcom Talk, Whatcom Kid Insider), a ticketing page, or a grocer's weekly ad. Never report from memory.
- Prefer the venue's own site. Mark confidence HIGH when the venue confirms it, MEDIUM when only a third party does, LOW when the source is old or vague.
- Skip anything that is permanently closed, and list closed venues separately.
- Use 24-hour "HH:MM" times and "YYYY-MM-DD" dates in America/Los_Angeles.
- When you are done searching, write your findings as plain structured notes: one block per item with venue, address, neighborhood, website, title, days, times, price, source URL and confidence. No prose essay.`;

function targetBrief(target: ScoutTarget, known: string[]): string {
  const today = todayIso();
  const knownList = known.length ? known.map((n) => `- ${n}`).join("\n") : "- (none yet)";
  switch (target) {
    case "RESTAURANTS":
      return `Today is ${today}. Research recurring weekly food and drink specials at restaurants, pubs, breweries, cideries and bars in Bellingham, WA: happy hours (days, times, sample prices), Taco Tuesday, pizza/burger/steak/prime-rib nights, wine nights, brunch specials, late-night menus, and similar.

Venues already in the database (verify a few are still current, and look for new venues not on this list):
${knownList}

Aim for 20-40 specials across at least 10 venues. Searching "Bellingham happy hour", "Bellingham taco tuesday", "Fairhaven happy hour", plus individual venue sites works well.`;
    case "GROCERY":
      return `Today is ${today}. Research grocery deals in Bellingham, WA for this week. Two kinds:
1. Standing programs (day-of-week or loyalty deals): e.g. Safeway $5 Friday, Fred Meyer digital deals and senior day, Community Food Co-op Fresh Deals (new each Wednesday) and member sales, Grocery Outlet WOW deals, Whole Foods Prime deals, Costco savings book, WinCo, Haggen for U, Bellingham Farmers Market (Saturdays, through mid-December).
2. This week's weekly-ad highlights (5-10 headline items per store where you can read the ad), with validFrom/validTo set to the ad window.

Stores already in the database:
${knownList}

Use the store name exactly as listed above when a deal belongs to a known store. Set type GROCERY on any new store.`;
    case "ACTIVITIES":
      return `Today is ${today}. Research date-night activities in Bellingham, WA:
1. Dated events from ${today} through ${addDays(today, 14)}: concerts, shows, comedy, dance nights, special screenings, festivals, markets. Check Mount Baker Theatre, Wild Buffalo, The Shakedown, The Blue Room, Pickford Film Center, The Upfront Theatre, Bellingham Theatre Guild, FireHouse Arts & Events Center, WWU, bellingham.org/Events, downtownbellingham.com, Cascadia Daily News.
2. Recurring weekly nights: public ice skating at Bellingham Sportsplex, pinball at The Racket, bowling, darts, trivia, karaoke, open mics, swing/salsa/contra/line dancing, live music series, axe throwing, mini golf, escape rooms.

Categories: ${ACTIVITY_CATEGORIES.join(", ")}.

Venues already in the database (reuse these names exactly; add new ones with type ACTIVITY):
${knownList}

Aim for 15-30 dated events and 15-30 recurring ones.`;
  }
}

// ---------------------------------------------------------------------------
// Claude calls
// ---------------------------------------------------------------------------

type ResearchOutcome = {
  notes: string;
  inputTokens: number;
  outputTokens: number;
  searches: number;
  model: string;
};

/** Phase 1: web research. Loops on `pause_turn` until Claude finishes. */
async function research(client: Anthropic, target: ScoutTarget, known: string[]): Promise<ResearchOutcome> {
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    { role: "user", content: targetBrief(target, known) },
  ];
  let inputTokens = 0;
  let outputTokens = 0;
  let searches = 0;
  let model = SCOUT_MODEL;
  let notes = "";

  for (let turn = 0; turn < 6; turn++) {
    const stream = client.beta.messages.stream({
      model: SCOUT_MODEL,
      max_tokens: 32000,
      system: SYSTEM,
      messages,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium" },
      tools: [
        {
          type: "web_search_20260209",
          name: "web_search",
          max_uses: 20,
          user_location: {
            type: "approximate",
            city: "Bellingham",
            region: "Washington",
            country: "US",
            timezone: "America/Los_Angeles",
          },
        },
      ],
    });
    const message = await stream.finalMessage();

    inputTokens += message.usage.input_tokens;
    outputTokens += message.usage.output_tokens;
    searches += message.usage.server_tool_use?.web_search_requests ?? 0;
    model = message.model;

    if (message.stop_reason === "refusal") {
      throw new Error(
        `Research declined (${message.stop_details?.category ?? "unknown"}): ${message.stop_details?.explanation ?? ""}`,
      );
    }

    const text = message.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    notes += text;

    if (message.stop_reason === "pause_turn") {
      // Hand the partial turn back so the server continues the search loop.
      messages.push({ role: "assistant", content: message.content });
      continue;
    }
    if (message.stop_reason === "max_tokens") {
      notes += "\n\n[notes truncated]";
    }
    break;
  }

  if (!notes.trim()) throw new Error("Research produced no notes");
  return { notes, inputTokens, outputTokens, searches, model };
}

/** Phase 2: notes → JSON. */
async function extract(client: Anthropic, target: ScoutTarget, notes: string) {
  const response = await client.messages.parse({
    model: SCOUT_MODEL,
    max_tokens: 16000,
    output_config: { format: zodOutputFormat(ScoutResultSchema), effort: "low" },
    system:
      "Convert research notes into the requested JSON. Keep only items with a real source. Use null for anything unknown. Venue names in deals/events must match an entry in `venues` exactly.",
    messages: [
      {
        role: "user",
        content: `Target: ${target}. Today: ${todayIso()}.\n\nNotes:\n\n${notes}`,
      },
    ],
  });
  if (response.stop_reason === "refusal") {
    throw new Error(`Extraction declined: ${response.stop_details?.explanation ?? ""}`);
  }
  const parsed = response.parsed_output;
  if (!parsed) throw new Error("Extraction returned no parseable JSON");
  return {
    result: parsed,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

function dateOnly(s: string | null): Date | null {
  return s ? new Date(`${s}T00:00:00.000Z`) : null;
}

async function applyResult(result: ScoutResult, target: ScoutTarget) {
  const today = todayIso();
  const idByName = new Map<string, number>();
  let venuesUpserted = 0;
  let dealsUpserted = 0;
  let eventsUpserted = 0;

  const defaultType: "RESTAURANT" | "GROCERY" | "ACTIVITY" =
    target === "GROCERY" ? "GROCERY" : target === "ACTIVITIES" ? "ACTIVITY" : "RESTAURANT";

  const ensureVenue = async (v: z.infer<typeof VenueSchema>) => {
    const slug = slugify(v.name);
    const existing = await prisma.venue.findUnique({ where: { slug } });
    const row = existing
      ? await prisma.venue.update({
          where: { slug },
          data: {
            // Scout data may be fresher than the seed — but never blank a
            // field we already had.
            category: v.category ?? existing.category,
            cuisine: v.cuisine ?? existing.cuisine,
            address: v.address ?? existing.address,
            neighborhood: v.neighborhood ?? existing.neighborhood,
            website: v.website ?? existing.website,
            weeklyAdUrl: v.weeklyAdUrl ?? existing.weeklyAdUrl,
            description: existing.description ?? v.description,
            active: true,
          },
        })
      : await prisma.venue.create({
          data: {
            slug,
            name: v.name,
            type: v.type ?? defaultType,
            category: v.category,
            cuisine: v.cuisine,
            address: v.address,
            neighborhood: v.neighborhood,
            website: v.website,
            weeklyAdUrl: v.weeklyAdUrl,
            description: v.description,
            source: "AI",
          },
        });
    idByName.set(v.name, row.id);
    venuesUpserted++;
    return row.id;
  };

  for (const v of result.venues) await ensureVenue(v);

  // A deal/event may reference a venue the model forgot to list; look it up
  // by slug, and create a bare row if it's genuinely new.
  const resolve = async (name: string, category: ActivityCategory | null) => {
    const cached = idByName.get(name);
    if (cached !== undefined) return cached;
    const existing = await prisma.venue.findUnique({ where: { slug: slugify(name) } });
    if (existing) {
      idByName.set(name, existing.id);
      return existing.id;
    }
    return ensureVenue({
      name,
      type: defaultType,
      category,
      cuisine: null,
      address: null,
      neighborhood: null,
      website: null,
      weeklyAdUrl: null,
      description: null,
    });
  };

  for (const d of result.deals) {
    if (d.validTo && d.validTo < today) continue; // already over
    const venueId = await resolve(d.venue, null);
    const data = {
      description: d.description,
      days: d.days as Weekday[],
      startTime: d.startTime,
      endTime: d.endTime,
      priceText: d.priceText,
      validFrom: dateOnly(d.validFrom),
      validTo: dateOnly(d.validTo),
      sourceUrl: d.sourceUrl,
      confidence: d.confidence,
      active: true,
      lastVerifiedAt: new Date(),
    };
    await prisma.deal.upsert({
      where: { venueId_title: { venueId, title: d.title } },
      create: { venueId, title: d.title, source: "AI", ...data },
      update: data,
    });
    dealsUpserted++;
  }

  for (const e of result.events) {
    const date = e.recurring ? null : dateOnly(e.date);
    if (!e.recurring && (!e.date || e.date < today)) continue;
    const venueId = await resolve(e.venue, e.category);
    const data = {
      category: e.category,
      description: e.description,
      recurring: e.recurring,
      days: e.recurring ? (e.days as Weekday[]) : [],
      startTime: e.startTime,
      endTime: e.endTime,
      priceText: e.priceText,
      sourceUrl: e.sourceUrl,
      confidence: e.confidence,
      active: true,
      lastVerifiedAt: new Date(),
    };
    const existing = await prisma.event.findFirst({ where: { venueId, title: e.title, date } });
    if (existing) {
      await prisma.event.update({ where: { id: existing.id }, data });
    } else {
      await prisma.event.create({ data: { venueId, title: e.title, date, source: "AI", ...data } });
    }
    eventsUpserted++;
  }

  // Closed venues: deactivate (soft) so their rows vanish from the board but
  // can be reviewed and restored by hand.
  for (const name of result.closedVenues) {
    await prisma.venue.updateMany({ where: { slug: slugify(name) }, data: { active: false } });
  }

  return { venuesUpserted, dealsUpserted, eventsUpserted };
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export type ScoutRunResult = {
  ok: boolean;
  runId: number;
  target: ScoutTarget;
  summary: string | null;
  error: string | null;
  venuesUpserted: number;
  dealsUpserted: number;
  eventsUpserted: number;
  inputTokens: number;
  outputTokens: number;
  searches: number;
  durationMs: number;
};

export async function runScout(target: ScoutTarget): Promise<ScoutRunResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set — the AI scout is disabled.");
  }
  const client = new Anthropic();
  const started = Date.now();
  const run = await prisma.scoutRun.create({ data: { target, model: SCOUT_MODEL } });

  const knownType =
    target === "GROCERY" ? "GROCERY" : target === "ACTIVITIES" ? "ACTIVITY" : "RESTAURANT";
  const known = (
    await prisma.venue.findMany({
      where: { active: true, type: knownType },
      select: { name: true },
      orderBy: { name: "asc" },
    })
  ).map((v) => v.name);

  try {
    const r = await research(client, target, known);
    const x = await extract(client, target, r.notes);
    const counts = await applyResult(x.result, target);
    const totals = {
      inputTokens: r.inputTokens + x.inputTokens,
      outputTokens: r.outputTokens + x.outputTokens,
      searches: r.searches,
    };
    await prisma.scoutRun.update({
      where: { id: run.id },
      data: {
        status: "SUCCESS",
        finishedAt: new Date(),
        model: r.model,
        summary: x.result.summary,
        ...counts,
        ...totals,
      },
    });
    return {
      ok: true,
      runId: run.id,
      target,
      summary: x.result.summary,
      error: null,
      ...counts,
      ...totals,
      durationMs: Date.now() - started,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.scoutRun.update({
      where: { id: run.id },
      data: { status: "FAILED", finishedAt: new Date(), error: message.slice(0, 2000) },
    });
    return {
      ok: false,
      runId: run.id,
      target,
      summary: null,
      error: message,
      venuesUpserted: 0,
      dealsUpserted: 0,
      eventsUpserted: 0,
      inputTokens: 0,
      outputTokens: 0,
      searches: 0,
      durationMs: Date.now() - started,
    };
  }
}
