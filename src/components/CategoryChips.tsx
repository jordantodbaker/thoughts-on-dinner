import { useEffect, useRef } from "react";
import type { ActivityCategory } from "~/generated/prisma/enums";
import { CATEGORY_META } from "~/lib/categories";
import { cn } from "~/lib/utils";

/**
 * One-tap activity-type filter. Only the categories that actually occur in
 * the current list are offered, so there's never a chip that empties the
 * page. Scrolls sideways on phones instead of wrapping into a tall block.
 */
export function CategoryChips({
  categories,
  selected,
  onSelect,
  allLabel = "Anything",
  className,
  children,
}: {
  categories: readonly ActivityCategory[];
  selected: ActivityCategory | null;
  onSelect: (category: ActivityCategory | null) => void;
  allLabel?: string;
  className?: string;
  /** Extra controls rendered at the end of the row (e.g. a "Surprise me" button). */
  children?: React.ReactNode;
}) {
  // On phones the row scrolls sideways; keep the active chip in view when
  // the page loads with a filter in the URL.
  const activeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    activeRef.current?.scrollIntoView({ inline: "nearest", block: "nearest" });
  }, [selected]);

  if (categories.length === 0) return null;
  const chip = (active: boolean) =>
    cn(
      "shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
      active ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted",
    );
  return (
    <div
      className={cn(
        "scroll-x -mx-4 flex items-center gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0",
        className,
      )}
      role="group"
      aria-label="Filter by activity type"
    >
      <button type="button" onClick={() => onSelect(null)} aria-pressed={selected === null} className={chip(selected === null)}>
        {allLabel}
      </button>
      {categories.map((c) => (
        <button
          key={c}
          ref={selected === c ? activeRef : undefined}
          type="button"
          onClick={() => onSelect(selected === c ? null : c)}
          aria-pressed={selected === c}
          className={chip(selected === c)}
        >
          {CATEGORY_META[c].emoji} {CATEGORY_META[c].label}
        </button>
      ))}
      {children}
    </div>
  );
}
