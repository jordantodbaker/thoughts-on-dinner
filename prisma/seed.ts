/**
 * Seed the database from prisma/seed-data/*.json.
 *
 * Idempotent: venues are upserted by slug, deals by (venue, title) and events
 * by (venue, title, date). Re-running after editing the JSON updates rows in
 * place and never duplicates. Rows the AI scout added (source = AI) are left
 * alone.
 *
 *   npm run db:seed
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import type {
  ActivityCategory,
  Confidence,
  Weekday,
} from "../src/generated/prisma/enums";
import { slugify } from "../src/lib/utils";

const here = dirname(fileURLToPath(import.meta.url));

type RawDeal = {
  venue: string;
  cuisine?: string | null;
  address?: string | null;
  neighborhood?: string | null;
  website?: string | null;
  title: string;
  description?: string | null;
  days: string[];
  startTime?: string | null;
  endTime?: string | null;
  priceText?: string | null;
  sourceUrl?: string | null;
  confidence?: string;
  validFrom?: string | null;
  validTo?: string | null;
};

type RawStore = {
  name: string;
  address?: string | null;
  neighborhood?: string | null;
  website?: string | null;
  weeklyAdUrl?: string | null;
  description?: string | null;
};

type RawActivityVenue = {
  name: string;
  category: string;
  address?: string | null;
  neighborhood?: string | null;
  website?: string | null;
  description?: string | null;
};

type RawEvent = {
  venue: string;
  category: string;
  title: string;
  description?: string | null;
  days?: string[];
  date?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  priceText?: string | null;
  sourceUrl?: string | null;
  confidence?: string;
};

function readJson<T>(name: string): T {
  return JSON.parse(readFileSync(join(here, "seed-data", name), "utf8")) as T;
}

function conf(s: string | undefined): Confidence {
  const u = (s ?? "MEDIUM").toUpperCase();
  return u === "HIGH" || u === "LOW" ? u : "MEDIUM";
}

function days(list: string[] | undefined): Weekday[] {
  return (list ?? []).map((d) => d.toUpperCase() as Weekday);
}

function dateOnly(s: string | null | undefined): Date | null {
  return s ? new Date(`${s}T00:00:00.000Z`) : null;
}

// Set by `seedDatabase` so the helpers below can run against any client (the
// real database from the CLI, or an in-memory PGlite in `scripts/verify-local.ts`).
let prisma: PrismaClient;

async function upsertVenue(input: {
  name: string;
  type: "RESTAURANT" | "GROCERY" | "ACTIVITY";
  category?: ActivityCategory | null;
  cuisine?: string | null;
  address?: string | null;
  neighborhood?: string | null;
  website?: string | null;
  weeklyAdUrl?: string | null;
  description?: string | null;
}) {
  const slug = slugify(input.name);
  const existing = await prisma.venue.findUnique({ where: { slug } });
  if (existing) {
    // A venue first seeded as a restaurant that also hosts events keeps its
    // type; we only fill in blanks so each file can contribute what it knows.
    return prisma.venue.update({
      where: { slug },
      data: {
        category: existing.category ?? input.category ?? null,
        cuisine: existing.cuisine ?? input.cuisine ?? null,
        address: existing.address ?? input.address ?? null,
        neighborhood: existing.neighborhood ?? input.neighborhood ?? null,
        website: existing.website ?? input.website ?? null,
        weeklyAdUrl: existing.weeklyAdUrl ?? input.weeklyAdUrl ?? null,
        description: existing.description ?? input.description ?? null,
        active: true,
      },
    });
  }
  return prisma.venue.create({
    data: {
      slug,
      name: input.name,
      type: input.type,
      category: input.category ?? null,
      cuisine: input.cuisine ?? null,
      address: input.address ?? null,
      neighborhood: input.neighborhood ?? null,
      website: input.website ?? null,
      weeklyAdUrl: input.weeklyAdUrl ?? null,
      description: input.description ?? null,
      source: "SEED",
    },
  });
}

async function upsertDeal(venueId: number, d: RawDeal) {
  const data = {
    description: d.description ?? null,
    days: days(d.days),
    startTime: d.startTime ?? null,
    endTime: d.endTime ?? null,
    priceText: d.priceText ?? null,
    validFrom: dateOnly(d.validFrom),
    validTo: dateOnly(d.validTo),
    sourceUrl: d.sourceUrl ?? null,
    confidence: conf(d.confidence),
    source: "SEED" as const,
    active: true,
    lastVerifiedAt: new Date(),
  };
  await prisma.deal.upsert({
    where: { venueId_title: { venueId, title: d.title } },
    create: { venueId, title: d.title, ...data },
    update: data,
  });
}

async function upsertEvent(venueId: number, e: RawEvent, recurring: boolean) {
  const date = recurring ? null : dateOnly(e.date);
  const data = {
    category: e.category as ActivityCategory,
    description: e.description ?? null,
    recurring,
    days: recurring ? days(e.days) : [],
    startTime: e.startTime ?? null,
    endTime: e.endTime ?? null,
    priceText: e.priceText ?? null,
    sourceUrl: e.sourceUrl ?? null,
    confidence: conf(e.confidence),
    source: "SEED" as const,
    active: true,
    lastVerifiedAt: new Date(),
  };
  // Prisma can't match NULL inside a compound unique, so dated vs recurring
  // rows take different paths.
  const existing = await prisma.event.findFirst({
    where: { venueId, title: e.title, date },
  });
  if (existing) {
    await prisma.event.update({ where: { id: existing.id }, data });
  } else {
    await prisma.event.create({ data: { venueId, title: e.title, date, ...data } });
  }
}

export async function seedDatabase(client: PrismaClient) {
  prisma = client;
  const restaurants = readJson<{ deals: RawDeal[] }>("restaurants.json");
  const grocery = readJson<{ stores: RawStore[]; deals: RawDeal[] }>("grocery.json");
  const activities = readJson<{
    venues: RawActivityVenue[];
    recurring: RawEvent[];
    dated: RawEvent[];
  }>("activities.json");

  let venues = 0;
  let deals = 0;
  let events = 0;

  // Restaurants: venue info rides along on each deal row.
  const seenRestaurant = new Map<string, number>();
  for (const d of restaurants.deals) {
    let venueId = seenRestaurant.get(d.venue);
    if (venueId === undefined) {
      const v = await upsertVenue({
        name: d.venue,
        type: "RESTAURANT",
        cuisine: d.cuisine,
        address: d.address,
        neighborhood: d.neighborhood,
        website: d.website,
      });
      venueId = v.id;
      seenRestaurant.set(d.venue, venueId);
      venues++;
    }
    await upsertDeal(venueId, d);
    deals++;
  }

  // Grocery stores.
  const storeIds = new Map<string, number>();
  for (const s of grocery.stores) {
    const v = await upsertVenue({ ...s, type: "GROCERY" });
    storeIds.set(s.name, v.id);
    venues++;
  }
  for (const d of grocery.deals) {
    const venueId = storeIds.get(d.venue);
    if (venueId === undefined) {
      console.warn(`[seed] grocery deal "${d.title}" references unknown store "${d.venue}"`);
      continue;
    }
    await upsertDeal(venueId, d);
    deals++;
  }

  // Activity venues and events.
  const activityIds = new Map<string, number>();
  for (const a of activities.venues) {
    const v = await upsertVenue({
      name: a.name,
      type: "ACTIVITY",
      category: a.category as ActivityCategory,
      address: a.address,
      neighborhood: a.neighborhood,
      website: a.website,
      description: a.description,
    });
    activityIds.set(a.name, v.id);
    venues++;
  }
  const resolveEventVenue = async (e: RawEvent) => {
    let id = activityIds.get(e.venue);
    if (id === undefined) {
      const v = await upsertVenue({
        name: e.venue,
        type: "ACTIVITY",
        category: e.category as ActivityCategory,
      });
      id = v.id;
      activityIds.set(e.venue, id);
      console.warn(`[seed] created bare venue for "${e.venue}" — add it to activities.json`);
    }
    return id;
  };
  for (const e of activities.recurring) {
    await upsertEvent(await resolveEventVenue(e), e, true);
    events++;
  }
  for (const e of activities.dated) {
    await upsertEvent(await resolveEventVenue(e), e, false);
    events++;
  }

  console.log(`[seed] venues touched: ${venues}, deals: ${deals}, events: ${events}`);
  return { venues, deals, events };
}

// CLI entry point (`npm run db:seed`). Skipped when imported by the verifier.
const isMain =
  typeof process.argv[1] === "string" && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  const client = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  seedDatabase(client)
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    })
    .finally(() => client.$disconnect());
}
