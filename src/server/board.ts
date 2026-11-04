import { createServerFn } from "@tanstack/react-start";
import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";
import { prisma } from "./db";
import { buildDayBoard, iso, loadActive, toVenue, venueSelect } from "./board-data";
import { addDays, isIsoDate, todayIso, weekDates, type IsoDate } from "~/lib/dates";
import type { DealItem, EventItem, WeekBoard } from "~/lib/types";

// ---------------------------------------------------------------------------
// Server functions
// ---------------------------------------------------------------------------

const weekInput = z.object({
  /** First day of the 7-day window. Defaults to today (rolling week). */
  start: z.string().optional(),
});

/** Seven days of deals + events starting at `start` (default: today). */
export const fetchWeekBoard = createServerFn({ method: "GET" })
  .validator((input: unknown) => weekInput.parse(input ?? {}))
  .handler(async ({ data }): Promise<WeekBoard> => {
    const today = todayIso();
    const start = data.start && isIsoDate(data.start) ? data.start : today;
    const { dealItems, eventItems } = await loadActive(prisma);
    return {
      start,
      today,
      days: weekDates(start).map((date) => buildDayBoard(date, dealItems, eventItems)),
    };
  });

export const weekBoardQueryOptions = (start?: IsoDate) =>
  queryOptions({
    queryKey: ["week-board", start ?? "rolling"],
    queryFn: () => fetchWeekBoard({ data: { start } }),
    staleTime: 5 * 60 * 1000,
  });

/** The grocery directory: every active store with its standing deals. */
export const fetchGroceryStores = createServerFn({ method: "GET" }).handler(async () => {
  const stores = await prisma.venue.findMany({
    where: { type: "GROCERY", active: true },
    select: { ...venueSelect, deals: { where: { active: true }, orderBy: { title: "asc" } } },
    orderBy: { name: "asc" },
  });
  const today = todayIso();
  return stores.map((s) => ({
    venue: toVenue(s),
    deals: s.deals
      .map(
        (d): DealItem => ({
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
          venue: toVenue(s),
        }),
      )
      // Hide dated deals that have already expired; keep upcoming ones.
      .filter((d) => !d.validTo || d.validTo >= today),
  }));
});

export const groceryStoresQueryOptions = () =>
  queryOptions({
    queryKey: ["grocery-stores"],
    queryFn: () => fetchGroceryStores(),
    staleTime: 5 * 60 * 1000,
  });

/** The activity directory: venues grouped for the browse page. */
export const fetchActivityVenues = createServerFn({ method: "GET" }).handler(async () => {
  const venues = await prisma.venue.findMany({
    where: { active: true, events: { some: { active: true } } },
    select: {
      ...venueSelect,
      events: {
        where: { active: true },
        orderBy: [{ recurring: "desc" }, { date: "asc" }, { startTime: "asc" }],
      },
    },
    orderBy: { name: "asc" },
  });
  const today = todayIso();
  const horizon = addDays(today, 30);
  return venues.map((v) => ({
    venue: toVenue(v),
    events: v.events
      .map(
        (e): EventItem => ({
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
          venue: toVenue(v),
        }),
      )
      .filter((e) => e.recurring || (e.date !== null && e.date >= today && e.date <= horizon)),
  }));
});

export const activityVenuesQueryOptions = () =>
  queryOptions({
    queryKey: ["activity-venues"],
    queryFn: () => fetchActivityVenues(),
    staleTime: 5 * 60 * 1000,
  });

/** Summary numbers for the admin/status page. */
export const fetchStatus = createServerFn({ method: "GET" }).handler(async () => {
  const [venues, deals, events, runs] = await Promise.all([
    prisma.venue.count({ where: { active: true } }),
    prisma.deal.count({ where: { active: true } }),
    prisma.event.count({ where: { active: true } }),
    prisma.scoutRun.findMany({ orderBy: { startedAt: "desc" }, take: 12 }),
  ]);
  return {
    counts: { venues, deals, events },
    scoutEnabled: Boolean(process.env.ANTHROPIC_API_KEY),
    runs: runs.map((r) => ({
      id: r.id,
      target: r.target,
      status: r.status,
      startedAt: r.startedAt.toISOString(),
      finishedAt: r.finishedAt?.toISOString() ?? null,
      model: r.model,
      summary: r.summary,
      error: r.error,
      venuesUpserted: r.venuesUpserted,
      dealsUpserted: r.dealsUpserted,
      eventsUpserted: r.eventsUpserted,
      inputTokens: r.inputTokens,
      outputTokens: r.outputTokens,
      searches: r.searches,
    })),
  };
});

export const statusQueryOptions = () =>
  queryOptions({
    queryKey: ["status"],
    queryFn: () => fetchStatus(),
    staleTime: 30 * 1000,
  });
