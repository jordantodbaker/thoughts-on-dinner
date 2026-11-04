import { describe, expect, it } from "vitest";
import {
  addDays,
  describeDays,
  formatTime,
  formatTimeRange,
  nowHHMM,
  startOfWeek,
  todayIso,
  weekDates,
  weekdayOf,
} from "./dates";

describe("dates", () => {
  it("computes today in Bellingham, not UTC", () => {
    // 2026-11-05T03:30Z is still the evening of Nov 4 in Pacific time.
    expect(todayIso(new Date("2026-11-05T03:30:00Z"))).toBe("2026-11-04");
    expect(nowHHMM(new Date("2026-11-05T03:30:00Z"))).toBe("19:30");
  });

  it("knows weekdays and week starts", () => {
    expect(weekdayOf("2026-11-04")).toBe("WED");
    expect(weekdayOf("2026-11-08")).toBe("SUN");
    expect(startOfWeek("2026-11-04")).toBe("2026-11-02");
    expect(startOfWeek("2026-11-02")).toBe("2026-11-02");
    expect(startOfWeek("2026-11-08")).toBe("2026-11-02");
  });

  it("does day arithmetic across month ends", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(weekDates("2026-11-04")).toHaveLength(7);
    expect(weekDates("2026-11-04")[6]).toBe("2026-11-10");
  });

  it("formats times for humans", () => {
    expect(formatTime("15:00")).toBe("3 PM");
    expect(formatTime("19:30")).toBe("7:30 PM");
    expect(formatTime("00:00")).toBe("12 AM");
    expect(formatTimeRange("15:00", "18:00")).toBe("3–6 PM");
    expect(formatTimeRange("11:30", "15:00")).toBe("11:30 AM–3 PM");
    expect(formatTimeRange("21:00", null)).toBe("from 9 PM");
    expect(formatTimeRange(null, "13:00")).toBe("until 1 PM");
  });

  it("describes day lists", () => {
    expect(describeDays([])).toBe("Daily");
    expect(describeDays(["MON", "TUE", "WED", "THU", "FRI"])).toBe("Mon–Fri");
    expect(describeDays(["TUE", "THU"])).toBe("Tue & Thu");
    expect(describeDays(["SUN", "MON", "WED"])).toBe("Mon, Wed, Sun");
  });
});
