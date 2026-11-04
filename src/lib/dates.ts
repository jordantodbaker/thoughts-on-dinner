/**
 * Date helpers. The app is pinned to Bellingham, so every "today" and every
 * weekday is computed in America/Los_Angeles regardless of where the server
 * runs (Vercel functions are UTC). Dates travel as ISO "YYYY-MM-DD" strings so
 * nothing ever shifts across the serializer boundary.
 */
export const TIME_ZONE = "America/Los_Angeles";

export type IsoDate = string; // "YYYY-MM-DD"

export const WEEKDAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const;
export type WeekdayCode = (typeof WEEKDAYS)[number];

export const WEEKDAY_LABEL: Record<WeekdayCode, string> = {
  MON: "Monday",
  TUE: "Tuesday",
  WED: "Wednesday",
  THU: "Thursday",
  FRI: "Friday",
  SAT: "Saturday",
  SUN: "Sunday",
};

export const WEEKDAY_SHORT: Record<WeekdayCode, string> = {
  MON: "Mon",
  TUE: "Tue",
  WED: "Wed",
  THU: "Thu",
  FRI: "Fri",
  SAT: "Sat",
  SUN: "Sun",
};

const isoFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const timeFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** Today's date in Bellingham as "YYYY-MM-DD". */
export function todayIso(now: Date = new Date()): IsoDate {
  return isoFmt.format(now);
}

/** Current wall-clock time in Bellingham as "HH:MM". */
export function nowHHMM(now: Date = new Date()): string {
  // en-GB with hour12:false yields "HH:MM"; some runtimes print "24:00" at midnight.
  return timeFmt.format(now).replace(/^24/, "00");
}

/** Parse "YYYY-MM-DD" into a UTC-noon Date, safe for day arithmetic. */
export function parseIso(iso: IsoDate): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12));
}

export function formatIso(d: Date): IsoDate {
  return d.toISOString().slice(0, 10);
}

export function isIsoDate(s: unknown): s is IsoDate {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(parseIso(s).getTime());
}

export function addDays(iso: IsoDate, n: number): IsoDate {
  const d = parseIso(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return formatIso(d);
}

/** Weekday code for an ISO date. */
export function weekdayOf(iso: IsoDate): WeekdayCode {
  // getUTCDay: 0 = Sunday
  const idx = parseIso(iso).getUTCDay();
  return WEEKDAYS[(idx + 6) % 7];
}

/** Monday of the week containing `iso`. */
export function startOfWeek(iso: IsoDate): IsoDate {
  const idx = (parseIso(iso).getUTCDay() + 6) % 7; // 0 = Monday
  return addDays(iso, -idx);
}

/** Seven consecutive ISO dates starting at `start`. */
export function weekDates(start: IsoDate): IsoDate[] {
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

const longFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  weekday: "long",
  month: "long",
  day: "numeric",
});
const shortFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  weekday: "short",
  month: "short",
  day: "numeric",
});
const dayNumFmt = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", day: "numeric" });
const monthDayFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  month: "short",
  day: "numeric",
});

export function formatLong(iso: IsoDate): string {
  return longFmt.format(parseIso(iso));
}
export function formatShort(iso: IsoDate): string {
  return shortFmt.format(parseIso(iso));
}
export function formatDayNumber(iso: IsoDate): string {
  return dayNumFmt.format(parseIso(iso));
}
export function formatMonthDay(iso: IsoDate): string {
  return monthDayFmt.format(parseIso(iso));
}

/** "19:30" -> "7:30 PM"; "15:00" -> "3 PM". */
export function formatTime(hhmm: string | null | undefined): string {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h)) return hhmm;
  const suffix = h >= 12 && h < 24 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return m ? `${hour12}:${String(m).padStart(2, "0")} ${suffix}` : `${hour12} ${suffix}`;
}

/** "15:00"–"18:00" -> "3–6 PM"; one-sided windows degrade gracefully. */
export function formatTimeRange(
  start: string | null | undefined,
  end: string | null | undefined,
): string {
  if (start && end) {
    const s = formatTime(start);
    const e = formatTime(end);
    const sameSuffix = s.slice(-2) === e.slice(-2);
    return sameSuffix ? `${s.slice(0, -3)}–${e}` : `${s}–${e}`;
  }
  if (start) return `from ${formatTime(start)}`;
  if (end) return `until ${formatTime(end)}`;
  return "";
}

/** Minutes since midnight for "HH:MM"; null when absent/invalid. */
export function toMinutes(hhmm: string | null | undefined): number | null {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

/** Human label for a list of weekday codes: "Mon–Fri", "Tue & Thu", "Daily". */
export function describeDays(days: readonly WeekdayCode[]): string {
  if (days.length === 0 || days.length === 7) return "Daily";
  const idx = days.map((d) => WEEKDAYS.indexOf(d)).sort((a, b) => a - b);
  const contiguous = idx.every((v, i) => i === 0 || v === idx[i - 1] + 1);
  if (contiguous && idx.length >= 3) {
    return `${WEEKDAY_SHORT[WEEKDAYS[idx[0]]]}–${WEEKDAY_SHORT[WEEKDAYS[idx[idx.length - 1]]]}`;
  }
  const names = idx.map((i) => WEEKDAY_SHORT[WEEKDAYS[i]]);
  if (names.length === 2) return `${names[0]} & ${names[1]}`;
  return names.join(", ");
}
