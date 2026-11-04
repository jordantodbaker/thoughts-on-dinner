import { formatDayNumber, WEEKDAY_SHORT, weekdayOf, type IsoDate } from "~/lib/dates";
import { cn } from "~/lib/utils";

/**
 * Seven tappable days that always fit the width — no sideways scrolling on a
 * phone. Counts show as "31·20" on small screens and "31 food · 20 fun" on
 * wider ones.
 */
export function DayStrip({
  dates,
  today,
  selected,
  counts,
  onSelect,
}: {
  dates: IsoDate[];
  today: IsoDate;
  selected: IsoDate;
  counts?: Record<IsoDate, { food: number; fun: number }>;
  onSelect: (date: IsoDate) => void;
}) {
  return (
    <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
      {dates.map((d) => {
        const isToday = d === today;
        const isSelected = d === selected;
        const c = counts?.[d];
        return (
          <button
            key={d}
            type="button"
            onClick={() => onSelect(d)}
            aria-pressed={isSelected}
            aria-label={`${isToday ? "Today, " : ""}${WEEKDAY_SHORT[weekdayOf(d)]} ${formatDayNumber(d)}`}
            className={cn(
              "flex min-w-0 flex-col items-center rounded-xl border px-0.5 py-1.5 text-[10px] transition-colors sm:px-2 sm:py-2 sm:text-xs",
              isSelected
                ? "border-primary bg-primary text-primary-foreground"
                : "bg-card hover:bg-muted",
              isToday && !isSelected && "border-accent/60",
            )}
          >
            <span className={cn("uppercase tracking-wide", !isSelected && "text-muted-foreground")}>
              {isToday ? "Today" : WEEKDAY_SHORT[weekdayOf(d)]}
            </span>
            <span className="text-base font-semibold leading-6 sm:text-lg">{formatDayNumber(d)}</span>
            {c ? (
              <span
                className={cn(
                  "whitespace-nowrap text-[10px] leading-4",
                  isSelected ? "opacity-80" : "text-muted-foreground",
                )}
              >
                <span className="sm:hidden">
                  {c.food}·{c.fun}
                </span>
                <span className="hidden sm:inline">
                  {c.food} food · {c.fun} fun
                </span>
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
