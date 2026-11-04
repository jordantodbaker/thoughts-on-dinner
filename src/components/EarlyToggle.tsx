import { Clock } from "lucide-react";
import { cn } from "~/lib/utils";

/**
 * Chip-style switch for the "Show events before 5" preference. `hidden` is
 * how many weekday-afternoon items the current view is suppressing, so the
 * label says what tapping it will reveal.
 */
export function EarlyToggle({
  on,
  hidden,
  onChange,
  className,
}: {
  on: boolean;
  hidden: number;
  onChange: (next: boolean) => void;
  className?: string;
}) {
  if (!on && hidden === 0) return null;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        on ? "border-accent bg-accent/15 text-accent" : "bg-card text-muted-foreground hover:bg-muted",
        className,
      )}
      title="Weekday events that end by 5 PM are hidden by default"
    >
      <Clock className="size-3" />
      {on ? "Showing events before 5" : `Show ${hidden} before 5`}
    </button>
  );
}
