import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { z } from "zod";
import { DayStrip } from "~/components/DayStrip";
import { EmptyState, SectionHeading } from "~/components/cards";
import { PairingCard } from "~/components/PairingCard";
import { Button } from "~/components/ui/button";
import { ACTIVITY_CATEGORIES, CATEGORY_META } from "~/lib/categories";
import { formatLong, type IsoDate } from "~/lib/dates";
import { buildPairings } from "~/lib/pairing";
import { cn } from "~/lib/utils";
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
  const category = search.type && (ACTIVITY_CATEGORIES as readonly string[]).includes(search.type) ? search.type : null;

  const counts = useMemo(
    () =>
      Object.fromEntries(
        board.days.map((d) => [d.date, { food: d.restaurantDeals.length, fun: d.events.length }]),
      ) as Record<IsoDate, { food: number; fun: number }>,
    [board.days],
  );

  const events = category ? day.events.filter((e) => e.category === category) : day.events;
  const pairings = useMemo(
    () => buildPairings(day.restaurantDeals, events, { limit: 30, perVenue: 3 }),
    [day.restaurantDeals, events],
  );

  const [surprise, setSurprise] = useState<number | null>(null);
  const featured = surprise === null ? null : pairings[surprise % pairings.length];

  const availableCategories = useMemo(() => {
    const set = new Set(day.events.map((e) => e.category));
    return ACTIVITY_CATEGORIES.filter((c) => set.has(c));
  }, [day.events]);

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

      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => navigate({ search: { day: search.day, type: undefined }, replace: true })}
          className={cn(
            "rounded-full border px-3 py-1 text-xs font-medium",
            !category ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground",
          )}
        >
          Anything
        </button>
        {availableCategories.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => navigate({ search: { day: search.day, type: c }, replace: true })}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium",
              category === c ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground",
            )}
          >
            {CATEGORY_META[c].emoji} {CATEGORY_META[c].label}
          </button>
        ))}
        <Button
          variant="accent"
          size="sm"
          className="ml-auto"
          disabled={pairings.length === 0}
          onClick={() => setSurprise((s) => (s === null ? 0 : s + 1))}
        >
          Surprise me
        </Button>
      </div>

      {featured ? <PairingCard pairing={featured} /> : null}

      <section>
        <SectionHeading
          title={formatLong(day.date)}
          count={pairings.length}
          hint="Ranked by neighborhood match and timing. Same-venue combos are left out on purpose."
        />
        {pairings.length ? (
          <div className="flex flex-col gap-3">
            {pairings.map((p) => (
              <PairingCard key={`${p.deal.id}-${p.event.id}`} pairing={p} />
            ))}
          </div>
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
