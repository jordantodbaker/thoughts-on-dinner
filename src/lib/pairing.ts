import { toMinutes } from "./dates";
import type { DealItem, EventItem } from "./types";

/**
 * Date-night pairing: a dinner deal plus an activity, scored on how well they
 * fit together on the same evening. Heuristics, not magic:
 *  - same neighborhood is the biggest win (walkable),
 *  - dinner should end before (or overlap the start of) the activity,
 *  - a timed activity beats an all-day venue listing,
 *  - one-off events (a show this Friday) beat a standing weekly night,
 *  - HIGH confidence rows edge out MEDIUM ones.
 */
export type Pairing = {
  deal: DealItem;
  event: EventItem;
  score: number;
  reasons: string[];
};

const DINNER_START = 16 * 60; // 4 PM
const DINNER_END = 21 * 60; // 9 PM

function overlapsDinner(deal: DealItem): boolean {
  const s = toMinutes(deal.startTime);
  const e = toMinutes(deal.endTime);
  if (s === null && e === null) return true; // all day
  const start = s ?? 0;
  let end = e ?? 24 * 60;
  if (end < start) end = 24 * 60; // crosses midnight
  return start < DINNER_END && end > DINNER_START;
}

function sameNeighborhood(a: string | null, b: string | null): boolean {
  if (!a || !b) return false;
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export function scorePair(deal: DealItem, event: EventItem): Pairing | null {
  if (deal.venue.type !== "RESTAURANT") return null;
  if (!overlapsDinner(deal)) return null;
  if (deal.venue.id === event.venue.id) return null; // eat and play in one spot isn't a "pairing"

  let score = 0;
  const reasons: string[] = [];

  if (sameNeighborhood(deal.venue.neighborhood, event.venue.neighborhood)) {
    score += 4;
    reasons.push(`Both in ${deal.venue.neighborhood}`);
  }

  const dealEnd = toMinutes(deal.endTime);
  const dealStart = toMinutes(deal.startTime);
  const eventStart = toMinutes(event.startTime);
  if (eventStart !== null) {
    score += 1;
    if (dealEnd !== null && dealEnd <= eventStart) {
      score += 2;
      reasons.push("Dinner wraps before it starts");
    } else if (dealEnd === null || dealStart === null || dealStart < eventStart) {
      score += 1;
      reasons.push("Eat first, then head over");
    } else {
      // Deal starts after the event begins: late-night food after the activity.
      reasons.push("Grab food after");
    }
  } else {
    reasons.push("Go whenever you're done eating");
  }

  if (!event.recurring) {
    score += 2;
    reasons.push("One-off this week");
  }
  if (event.confidence === "HIGH") score += 1;
  if (deal.confidence === "HIGH") score += 1;

  return { deal, event, score, reasons };
}

/** Top pairings for a day, best first, no venue repeated more than `perVenue` times. */
export function buildPairings(
  deals: DealItem[],
  events: EventItem[],
  opts: { limit?: number; perVenue?: number } = {},
): Pairing[] {
  const limit = opts.limit ?? 12;
  const perVenue = opts.perVenue ?? 2;
  const all: Pairing[] = [];
  for (const deal of deals) {
    for (const event of events) {
      const p = scorePair(deal, event);
      if (p) all.push(p);
    }
  }
  // Stable: score desc, then earlier event start, then names — so SSR and
  // client agree on order.
  all.sort(
    (a, b) =>
      b.score - a.score ||
      (a.event.startTime ?? "99").localeCompare(b.event.startTime ?? "99") ||
      a.event.title.localeCompare(b.event.title) ||
      a.deal.venue.name.localeCompare(b.deal.venue.name),
  );

  const dealCount = new Map<number, number>();
  const eventCount = new Map<number, number>();
  const out: Pairing[] = [];
  for (const p of all) {
    const dc = dealCount.get(p.deal.venue.id) ?? 0;
    const ec = eventCount.get(p.event.venue.id) ?? 0;
    if (dc >= perVenue || ec >= perVenue) continue;
    dealCount.set(p.deal.venue.id, dc + 1);
    eventCount.set(p.event.venue.id, ec + 1);
    out.push(p);
    if (out.length >= limit) break;
  }
  return out;
}

/** Deterministic pick for a given seed so SSR and hydration agree. */
export function pickPairing(pairings: Pairing[], seed: number): Pairing | null {
  if (pairings.length === 0) return null;
  return pairings[Math.abs(seed) % pairings.length];
}
