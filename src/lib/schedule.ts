import type { IsoDate } from "./dates";
import { weekdayOf } from "./dates";
import type { DealItem, EventItem } from "./types";

/**
 * Pure "does this happen on this date" logic, shared by the server (building
 * the week board) and by tests. Kept free of Prisma so it's trivially testable.
 */

export function dealAppliesOn(deal: DealItem, date: IsoDate): boolean {
  if (deal.validFrom && date < deal.validFrom) return false;
  if (deal.validTo && date > deal.validTo) return false;
  if (deal.days.length === 0) return true;
  return deal.days.includes(weekdayOf(date));
}

export function eventAppliesOn(event: EventItem, date: IsoDate): boolean {
  if (!event.recurring) return event.date === date;
  if (event.days.length === 0) return true;
  return event.days.includes(weekdayOf(date));
}

/** Sort key: things with a start time first (by time), then untimed. */
export function byStartTime<T extends { startTime: string | null }>(a: T, b: T): number {
  if (a.startTime && b.startTime) return a.startTime.localeCompare(b.startTime);
  if (a.startTime) return -1;
  if (b.startTime) return 1;
  return 0;
}

/** Has this timed thing already ended for the day? (Untimed things never "end".) */
export function hasEnded(item: { endTime: string | null; startTime: string | null }, nowHHMM: string): boolean {
  const end = item.endTime;
  if (!end) return false;
  // Windows that cross midnight ("21:00"–"02:00") are still live in the evening.
  if (item.startTime && end < item.startTime) return false;
  return end <= nowHHMM;
}

/**
 * Grocery deals worth surfacing on a specific day: tied to a weekday (Safeway
 * $5 Friday, the Saturday market) or to a dated ad window. Standing loyalty
 * programs (days = [] and no window) live on the grocery page instead.
 */
export function isDaySpecific(deal: { days: readonly unknown[]; validFrom: string | null; validTo: string | null }): boolean {
  return deal.days.length > 0 || deal.validFrom !== null || deal.validTo !== null;
}
