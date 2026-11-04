import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { z } from "zod";
import { DayStrip } from "~/components/DayStrip";
import { EmptyState, SectionHeading } from "~/components/cards";
import { CategoryChips } from "~/components/CategoryChips";
import { PairingCard } from "~/components/PairingCard";
import { CollapsibleList } from "~/components/CollapsibleList";
import { Button } from "~/components/ui/button";
import { ACTIVITY_CATEGORIES, isActivityCategory } from "~/lib/categories";
import { formatLong, type IsoDate } from "~/lib/dates";
import { buildPairings } from "~/lib/pairing";
import { afterWorkFirst, countEarly } from "~/lib/schedule";
import { useShowEarly } from "~/lib/use-show-early";
import { EarlyToggle } from "~/components/EarlyToggle";
import { weekBoardQueryOptions } from "~/server/board";

const searchSchema = z.object({
  day: z.string().optional().catch(undefined),
  type: z.string().optional().catch(undefined),
});

export const Route = createFileRoute("/date-night")({
  validateSearch: searchSchema,
  loader: ({ context }) => context.queryClient.ensureQueryData(weekBoardQueryOptions()),
  component: DateNightPage,
});

function DateNightPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const { data: board } = useSuspenseQuery(weekBoardQueryOptions());
  const dates = board.days.map((d) => d.date);
  const selected: IsoDate = search.day && dates.includes(search.day) ? search.day : dates[0];
  const day = board.days.find((d) => d.date === selected) ?? board.days[0];
  const category = isActivityCategory(search.type) ? search.type : null;

  // Weekday specials and events that end by 5 PM are hidden unless asked
  // for; when shown they sort to the bottom.
  const [showEarly, setShowEarly] = useShowEarly();
  const dealsAfterWork = useMemo(
    () => afterWorkFirst(day.restaurantDeals, day.date, showEarly),
    [day.restaurantDeals, day.date, showEarly],
  );
  const afterWork = useMemo(
    () => afterWorkFirst(day.events, day.date, showEarly),
    [day.events, day.date, showEarly],
  );
  const earlyHidden = showEarly
    ? 0
    : countEarly(day.restaurantDeals, day.date) + countEarly(day.events, day.date);

  const counts = useMemo(
    () =>
      Object.fromEntries(
        board.days.map((d) => [
          d.date,
          {
            food: afterWorkFirst(d.restaurantDeals, d.date, showEarly).length,
            fun: afterWorkFirst(d.events, d.date, showEarly).length,
          },
        ]),
      ) as Record<IsoDate, { food: number; fun: number }>,
    [board.days, showEarly],
  );

  const events = useMemo(
    () => (category ? afterWork.filter((e) => e.category === category) : afterWork),
    [afterWork, category],
  );
  const pairings = useMemo(
    () => buildPairings(dealsAfterWork, events, { limit: 30, perVenue: 3 }),
    [dealsAfterWork, events],
  );

  const [surprise, setSurprise] = useState<number | null>(null);
  const featured = surprise === null ? null : pairings[surprise % pairings.length];

  const availableCategories = useMemo(() => {
    const set = new Set(afterWork.map((e) => e.category));
    return ACTIVITY_CATEGORIES.filter((c) => set.has(c));
  }, [afterWork]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-sm text-muted-foreground">Dinner first, then something fun.</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Plan a date night</h1>
      </div>

      <DayStrip
        dates={dates}
        today={board.today}
        selected={selected}
        counts={counts}
        onSelect={(d) => {
          setSurprise(null);
          navigate({ search: { day: d, type: search.type }, replace: true });
        }}
      />

      <CategoryChips
        categories={availableCategories}
        selected={category}
        onSelect={(c) => navigate({ search: { day: search.day, type: c ?? undefined }, replace: true })}
      >
        <EarlyToggle on={showEarly} hidden={earlyHidden} onChange={setShowEarly} className="sm:ml-auto" />
        <Button
          variant="accent"
          size="sm"
          className="shrink-0"
          disabled={pairings.length === 0}
          onClick={() => setSurprise((s) => (s === null ? 0 : s + 1))}
        >
          Surprise me
        </Button>
      </CategoryChips>

      {featured ? <PairingCard pairing={featured} /> : null}

      <section>
        <SectionHeading
          title={formatLong(day.date)}
          count={pairings.length}
          hint="Ranked by neighborhood match and timing. Same-venue combos are left out on purpose."
        />
        {pairings.length ? (
          <CollapsibleList items={pairings.length} className="flex flex-col gap-3">
            {pairings.map((p) => (
              <PairingCard key={`${p.deal.id}-${p.event.id}`} pairing={p} />
            ))}
          </CollapsibleList>
        ) : (
          <EmptyState>
            {day.restaurantDeals.length === 0
              ? "No dinner specials on this day yet."
              : "No activities of that type on this day. Try another category."}
          </EmptyState>
        )}
      </section>
    </div>
  );
}
