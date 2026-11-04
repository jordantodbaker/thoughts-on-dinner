/**
 * Query + shaping logic for the board, parameterized on a Prisma client so it
 * never imports `./db`. That matters: anything a route module imports outside
 * a server-function handler lands in the client bundle, and the Prisma client
 * (Node `Buffer`, `pg`) must stay server-only. `board.ts` passes `prisma` in
 * from inside its handlers; `scripts/verify-local.ts` passes a PGlite client.
 */
import type { PrismaClient } from "~/generated/prisma/client";
import { formatIso, type IsoDate } from "~/lib/dates";
import { byStartTime, bySpecialness, dealAppliesOn, eventAppliesOn } from "~/lib/schedule";
import type { DayBoard, DealItem, EventItem, VenueSummary } from "~/lib/types";

// ---------------------------------------------------------------------------
// Row → item mappers. Dates leave the server as "YYYY-MM-DD" strings.
// ---------------------------------------------------------------------------

export const venueSelect = {
  id: true,
  slug: true,
  name: true,
  type: true,
  category: true,
  cuisine: true,
  address: true,
  neighborhood: true,
  website: true,
  weeklyAdUrl: true,
  description: true,
} as const;

type VenueRow = { [K in keyof typeof venueSelect]: unknown } & VenueSummary;

export function toVenue(v: VenueRow): VenueSummary {
  return {
    id: v.id,
    slug: v.slug,
    name: v.name,
    type: v.type,
    category: v.category,
    cuisine: v.cuisine,
    address: v.address,
    neighborhood: v.neighborhood,
    website: v.website,
    weeklyAdUrl: v.weeklyAdUrl,
    description: v.description,
  };
}

export function iso(d: Date | null): IsoDate | null {
  return d ? formatIso(d) : null;
}

/** Everything active, with venues, in one query each. The data set is small
 *  (hundreds of rows), so filtering per day in memory beats seven round trips. */
export async function loadActive(client: PrismaClient) {
  const [deals, events] = await Promise.all([
    client.deal.findMany({
      where: { active: true, venue: { active: true } },
      include: { venue: { select: venueSelect } },
      orderBy: [{ startTime: "asc" }, { title: "asc" }],
    }),
    client.event.findMany({
      where: { active: true, venue: { active: true } },
      include: { venue: { select: venueSelect } },
      orderBy: [{ startTime: "asc" }, { title: "asc" }],
    }),
  ]);

  const dealItems: DealItem[] = deals.map((d) => ({
    id: d.id,
    title: d.title,
    description: d.description,
    days: d.days,
    startTime: d.startTime,
    endTime: d.endTime,
    priceText: d.priceText,
    validFrom: iso(d.validFrom),
    validTo: iso(d.validTo),
    sourceUrl: d.sourceUrl,
    confidence: d.confidence,
    source: d.source,
    lastVerifiedAt: d.lastVerifiedAt?.toISOString() ?? null,
    venue: toVenue(d.venue),
  }));

  const eventItems: EventItem[] = events.map((e) => ({
    id: e.id,
    category: e.category,
    title: e.title,
    description: e.description,
    recurring: e.recurring,
    days: e.days,
    date: iso(e.date),
    startTime: e.startTime,
    endTime: e.endTime,
    priceText: e.priceText,
    sourceUrl: e.sourceUrl,
    confidence: e.confidence,
    source: e.source,
    lastVerifiedAt: e.lastVerifiedAt?.toISOString() ?? null,
    venue: toVenue(e.venue),
  }));

  return { dealItems, eventItems };
}

export function buildDayBoard(
  date: IsoDate,
  dealItems: DealItem[],
  eventItems: EventItem[],
): DayBoard {
  // Specials that make tonight different lead; the standing happy hours follow.
  const deals = dealItems.filter((d) => dealAppliesOn(d, date)).sort(bySpecialness);
  return {
    date,
    restaurantDeals: deals.filter((d) => d.venue.type === "RESTAURANT"),
    groceryDeals: deals.filter((d) => d.venue.type === "GROCERY"),
    events: eventItems.filter((e) => eventAppliesOn(e, date)).sort(byStartTime),
  };
}

