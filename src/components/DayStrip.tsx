import { formatDayNumber, WEEKDAY_SHORT, weekdayOf, type IsoDate } from "~/lib/dates";
import { cn } from "~/lib/utils";

/** Seven tappable days; counts underneath tell you which nights are busy. */
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
    <div className="scroll-x -mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
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
            className={cn(
              "flex min-w-[4.5rem] flex-1 flex-col items-center rounded-xl border px-2 py-2 text-xs transition-colors",
              isSelected
                ? "border-primary bg-primary text-primary-foreground"
                : "bg-card hover:bg-muted",
            )}
          >
            <span className={cn("uppercase tracking-wide", !isSelected && "text-muted-foreground")}>
              {isToday ? "Today" : WEEKDAY_SHORT[weekdayOf(d)]}
            </span>
            <span className="text-lg font-semibold leading-6">{formatDayNumber(d)}</span>
            {c ? (
              <span className={cn("text-[10px]", isSelected ? "opacity-80" : "text-muted-foreground")}>
                {c.food} food · {c.fun} fun
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
