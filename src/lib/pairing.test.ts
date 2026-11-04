import { describe, expect, it } from "vitest";
import { buildPairings, pickPairing, scorePair } from "./pairing";
import { dealAppliesOn, eventAppliesOn, hasEnded } from "./schedule";
import type { DealItem, EventItem, VenueSummary } from "./types";

let nextId = 1;
function venue(over: Partial<VenueSummary> = {}): VenueSummary {
  const id = nextId++;
  return {
    id,
    slug: `v${id}`,
    name: `Venue ${id}`,
    type: "RESTAURANT",
    category: null,
    cuisine: null,
    address: null,
    neighborhood: "Downtown",
    website: null,
    weeklyAdUrl: null,
    description: null,
    ...over,
  };
}
function deal(over: Partial<DealItem> = {}): DealItem {
  return {
    id: nextId++,
    title: "Happy Hour",
    description: null,
    days: [],
    startTime: "15:00",
    endTime: "18:00",
    priceText: null,
    validFrom: null,
    validTo: null,
    sourceUrl: null,
    confidence: "HIGH",
    source: "SEED",
    lastVerifiedAt: null,
    venue: venue(),
    ...over,
  };
}
function event(over: Partial<EventItem> = {}): EventItem {
  return {
    id: nextId++,
    category: "TRIVIA",
    title: "Trivia",
    description: null,
    recurring: true,
    days: ["WED"],
    date: null,
    startTime: "19:00",
    endTime: "21:00",
    priceText: null,
    sourceUrl: null,
    confidence: "HIGH",
    source: "SEED",
    lastVerifiedAt: null,
    venue: venue({ type: "ACTIVITY", category: "TRIVIA" }),
    ...over,
  };
}

describe("schedule", () => {
  it("matches deals by weekday and validity window", () => {
    const wed = "2026-11-04";
    expect(dealAppliesOn(deal({ days: ["WED"] }), wed)).toBe(true);
    expect(dealAppliesOn(deal({ days: ["THU"] }), wed)).toBe(false);
    expect(dealAppliesOn(deal({ days: [] }), wed)).toBe(true);
    expect(dealAppliesOn(deal({ validFrom: "2026-11-05" }), wed)).toBe(false);
    expect(dealAppliesOn(deal({ validTo: "2026-11-03" }), wed)).toBe(false);
    expect(dealAppliesOn(deal({ validFrom: "2026-11-01", validTo: "2026-11-10" }), wed)).toBe(true);
  });

  it("matches recurring and dated events", () => {
    expect(eventAppliesOn(event({ days: ["WED"] }), "2026-11-04")).toBe(true);
    expect(eventAppliesOn(event({ days: ["FRI"] }), "2026-11-04")).toBe(false);
    expect(eventAppliesOn(event({ recurring: false, date: "2026-11-04", days: [] }), "2026-11-04")).toBe(true);
    expect(eventAppliesOn(event({ recurring: false, date: "2026-11-05", days: [] }), "2026-11-04")).toBe(false);
  });

  it("knows when something has ended, including past-midnight windows", () => {
    expect(hasEnded({ startTime: "15:00", endTime: "18:00" }, "18:30")).toBe(true);
    expect(hasEnded({ startTime: "15:00", endTime: "18:00" }, "17:00")).toBe(false);
    expect(hasEnded({ startTime: "21:00", endTime: "02:00" }, "23:00")).toBe(false);
    expect(hasEnded({ startTime: "21:00", endTime: null }, "23:59")).toBe(false);
  });
});

describe("pairing", () => {
  it("rejects grocery deals, lunch-only deals and same-venue combos", () => {
    expect(scorePair(deal({ venue: venue({ type: "GROCERY" }) }), event())).toBeNull();
    expect(scorePair(deal({ startTime: "11:00", endTime: "14:00" }), event())).toBeNull();
    const shared = venue();
    expect(scorePair(deal({ venue: shared }), event({ venue: shared }))).toBeNull();
  });

  it("prefers the same neighborhood and dinner-before-show timing", () => {
    const fairhavenEvent = event({ venue: venue({ type: "ACTIVITY", neighborhood: "Fairhaven" }) });
    const near = scorePair(deal({ venue: venue({ neighborhood: "Fairhaven" }) }), fairhavenEvent)!;
    const far = scorePair(deal({ venue: venue({ neighborhood: "Cordata" }) }), fairhavenEvent)!;
    expect(near.score).toBeGreaterThan(far.score);
    expect(near.reasons).toContain("Both in Fairhaven");
    expect(near.reasons).toContain("Dinner wraps before it starts");
  });

  it("ranks one-off events above standing weekly nights", () => {
    const d = deal();
    const weekly = scorePair(d, event())!;
    const oneOff = scorePair(d, event({ recurring: false, date: "2026-11-04", days: [] }))!;
    expect(oneOff.score).toBeGreaterThan(weekly.score);
  });

  it("caps repeats per venue and picks deterministically", () => {
    const d1 = deal();
    const d2 = deal();
    const events = [event(), event(), event(), event()];
    const pairings = buildPairings([d1, d2], events, { perVenue: 1 });
    expect(pairings).toHaveLength(2);
    expect(new Set(pairings.map((p) => p.deal.venue.id)).size).toBe(2);
    expect(pickPairing(pairings, 0)).toBe(pairings[0]);
    expect(pickPairing(pairings, 1)).toBe(pairings[1]);
    expect(pickPairing([], 3)).toBeNull();
  });
});
