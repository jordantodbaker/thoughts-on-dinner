import type { IsoDate } from "./dates";
import { toMinutes, weekdayOf } from "./dates";
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

/**
 * How "special" a deal is for the day being shown. Lower sorts first.
 *
 *   0  runs one or two days a week, or has a dated window — Taco Tuesday,
 *      Wednesday steak night, a weekly-ad item: the reason to go out tonight
 *   1  three or four days — Thu–Sat prime rib, a Tue–Thu oyster hour
 *   2  every day or every weekday — the standing happy hour
 *
 * Within a tier, anything titled as a happy hour or late-night menu sorts
 * after a named special, so "Taco Tuesday" beats "All-Day Sunday Happy Hour".
 */
export function dealTier(deal: { days: readonly unknown[]; validFrom: string | null; validTo: string | null }): 0 | 1 | 2 {
  if (deal.validFrom !== null || deal.validTo !== null) return 0;
  const n = deal.days.length;
  if (n === 0 || n >= 5) return 2;
  return n <= 2 ? 0 : 1;
}

const ROUTINE_TITLE = /happy hour|late[- ]night|lunch combo|digital|loyalty|rewards|coupons|for u\b/i;

export function isRoutineTitle(title: string): boolean {
  return ROUTINE_TITLE.test(title);
}

/** Sort: most special first, named specials before happy hours, then by start time. */
export function bySpecialness<T extends { title: string; days: readonly unknown[]; validFrom: string | null; validTo: string | null; startTime: string | null }>(a: T, b: T): number {
  return (
    dealTier(a) - dealTier(b) ||
    Number(isRoutineTitle(a.title)) - Number(isRoutineTitle(b.title)) ||
    byStartTime(a, b)
  );
}

const WORKDAY_END = 17 * 60; // 5 PM

/**
 * True when the item is over by 5 PM on a Monday–Friday — a lunchtime
 * skate session or a 4 PM jazz hour that someone working until 4:30 can't
 * make. Weekends are never "early". Untimed items and windows that run past
 * midnight are kept.
 */
export function endsBeforeWorkEnd(
  item: { startTime: string | null; endTime: string | null },
  date: IsoDate,
): boolean {
  const end = toMinutes(item.endTime);
  if (end === null) return false;
  const start = toMinutes(item.startTime);
  if (start !== null && end < start) return false; // crosses midnight
  const day = weekdayOf(date);
  if (day === "SAT" || day === "SUN") return false;
  return end <= WORKDAY_END;
}
