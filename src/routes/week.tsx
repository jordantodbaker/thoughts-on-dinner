import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { z } from "zod";
import { DayStrip } from "~/components/DayStrip";
import { DealCard, EmptyState, EventCard, SectionHeading } from "~/components/cards";
import { CollapsibleList } from "~/components/CollapsibleList";
import { Button } from "~/components/ui/button";
import { ACTIVITY_CATEGORIES, CATEGORY_META } from "~/lib/categories";
import { addDays, formatLong, formatMonthDay, isIsoDate, WEEKDAY_SHORT, weekdayOf, type IsoDate } from "~/lib/dates";
import { afterWorkFirst, countEarly, isDaySpecific } from "~/lib/schedule";
import { useShowEarly } from "~/lib/use-show-early";
import { EarlyToggle } from "~/components/EarlyToggle";
import type { DayBoard } from "~/lib/types";
import { cn } from "~/lib/utils";
import { weekBoardQueryOptions } from "~/server/board";

const searchSchema = z.object({
  start: z.string().optional().catch(undefined),
  day: z.string().optional().catch(undefined),
});

export const Route = createFileRoute("/week")({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ start: search.start }),
  loader: ({ context, deps }) =>
    context.queryClient.ensureQueryData(
      weekBoardQueryOptions(deps.start && isIsoDate(deps.start) ? deps.start : undefined),
    ),
  component: WeekPage,
});

type Lane = "food" | "fun" | "grocery";

function WeekPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const start = search.start && isIsoDate(search.start) ? search.start : undefined;
  const { data: board } = useSuspenseQuery(weekBoardQueryOptions(start));

  const dates = board.days.map((d) => d.date);
  const selected: IsoDate =
    search.day && dates.includes(search.day) ? search.day : dates[0];
  const day = board.days.find((d) => d.date === selected) ?? board.days[0];

  const [lanes, setLanes] = useState<Record<Lane, boolean>>({ food: true, fun: true, grocery: false });
  const [category, setCategory] = useState<string | null>(null);

  // Weekday specials and events that end by 5 PM are hidden unless asked
  // for; when shown they sort to the bottom.
  const [showEarly, setShowEarly] = useShowEarly();
  const dealsAfterWork = (d: DayBoard) => afterWorkFirst(d.restaurantDeals, d.date, showEarly);
  const afterWork = (d: DayBoard) => afterWorkFirst(d.events, d.date, showEarly);
  const filteredEvents = (d: DayBoard) =>
    category ? afterWork(d).filter((e) => e.category === category) : afterWork(d);
  const earlyHidden = showEarly
    ? 0
    : countEarly(day.restaurantDeals, day.date) + countEarly(day.events, day.date);

  const counts = useMemo(
    () =>
      Object.fromEntries(
        board.days.map((d) => [d.date, { food: dealsAfterWork(d).length, fun: afterWork(d).length }]),
      ) as Record<IsoDate, { food: number; fun: number }>,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [board.days, showEarly],
  );

  const toggleLane = (l: Lane) => setLanes((s) => ({ ...s, [l]: !s[l] }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            {formatMonthDay(dates[0])} – {formatMonthDay(dates[6])}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">This week</h1>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate({ search: { start: addDays(dates[0], -7), day: undefined } })}
          >
            ← Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate({ search: { start: undefined, day: undefined } })}
            disabled={!start}
          >
            Today
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate({ search: { start: addDays(dates[0], 7), day: undefined } })}
          >
            Next →
          </Button>
        </div>
      </div>

      <DayStrip
        dates={dates}
        today={board.today}
        selected={selected}
        counts={counts}
        onSelect={(d) => navigate({ search: { start, day: d }, replace: true })}
      />

      <div className="flex flex-wrap items-center gap-1.5">
        {(
          [
            ["food", "Restaurants"],
            ["fun", "Activities"],
            ["grocery", "Grocery"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => toggleLane(key)}
            aria-pressed={lanes[key]}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium",
              lanes[key] ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground",
            )}
          >
            {label}
          </button>
        ))}
        <span className="mx-1 h-4 w-px bg-border" />
        <select
          value={category ?? ""}
          onChange={(e) => setCategory(e.target.value || null)}
          className="h-7 rounded-full border bg-card px-2 text-xs"
          aria-label="Filter activities by category"
        >
          <option value="">All activity types</option>
          {ACTIVITY_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_META[c].emoji} {CATEGORY_META[c].label}
            </option>
          ))}
        </select>
        <EarlyToggle on={showEarly} hidden={earlyHidden} onChange={setShowEarly} />
      </div>

      {/* Selected day, in full. */}
      <section>
        <SectionHeading title={formatLong(day.date)} />
        <div className="grid gap-6 lg:grid-cols-2">
          {lanes.food ? (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-muted-foreground">
                Restaurant specials · {dealsAfterWork(day).length}
              </h3>
              <CollapsibleList items={dealsAfterWork(day).length} className="flex flex-col gap-2">
                {dealsAfterWork(day).length ? (
                  dealsAfterWork(day).map((d) => <DealCard key={d.id} deal={d} />)
                ) : (
                  <EmptyState>No specials listed.</EmptyState>
                )}
              </CollapsibleList>
            </div>
          ) : null}
          {lanes.fun ? (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-muted-foreground">
                Activities · {filteredEvents(day).length}
              </h3>
              <CollapsibleList items={filteredEvents(day).length} className="flex flex-col gap-2">
                {filteredEvents(day).length ? (
                  filteredEvents(day).map((e) => <EventCard key={e.id} event={e} />)
                ) : (
                  <EmptyState>Nothing in this category.</EmptyState>
                )}
              </CollapsibleList>
            </div>
          ) : null}
          {lanes.grocery ? (
            <div className="lg:col-span-2">
              <h3 className="mb-2 text-sm font-semibold text-muted-foreground">
                Grocery · {day.groceryDeals.filter(isDaySpecific).length}
              </h3>
              <CollapsibleList items={day.groceryDeals.filter(isDaySpecific).length} className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {day.groceryDeals.filter(isDaySpecific).length ? (
                  day.groceryDeals.filter(isDaySpecific).map((d) => <DealCard key={d.id} deal={d} compact />)
                ) : (
                  <EmptyState>No grocery deals specific to this day.</EmptyState>
                )}
              </CollapsibleList>
            </div>
          ) : null}
        </div>
      </section>

      {/* Whole week at a glance (wide screens). */}
      <section className="hidden md:block">
        <SectionHeading title="At a glance" hint="Every day this week. Click a day above for details." />
        <div className="grid grid-cols-7 gap-2">
          {board.days.map((d) => {
            const events = filteredEvents(d);
            return (
              <div
                key={d.date}
                className={cn(
                  "min-w-0 rounded-xl border bg-card p-2",
                  d.date === selected && "border-primary",
                  d.date === board.today && "ring-1 ring-accent/50",
                )}
              >
                <button
                  type="button"
                  className="mb-1 w-full text-left text-xs font-semibold"
                  onClick={() => navigate({ search: { start, day: d.date }, replace: true })}
                >
                  {WEEKDAY_SHORT[weekdayOf(d.date)]} {formatMonthDay(d.date)}
                </button>
                <ul className="flex flex-col gap-1 text-[11px] leading-4">
                  {lanes.food
                    ? d.restaurantDeals.slice(0, 6).map((x) => (
                        <li key={`d${x.id}`} className="truncate" title={`${x.title} — ${x.venue.name}`}>
                          🍽️ {x.venue.name}: {x.title}
                        </li>
                      ))
                    : null}
                  {lanes.food && d.restaurantDeals.length > 6 ? (
                    <li className="text-muted-foreground">+{d.restaurantDeals.length - 6} more</li>
                  ) : null}
                  {lanes.fun
                    ? events.slice(0, 6).map((x) => (
                        <li key={`e${x.id}`} className="truncate" title={`${x.title} — ${x.venue.name}`}>
                          {CATEGORY_META[x.category].emoji} {x.title}
                        </li>
                      ))
                    : null}
                  {lanes.fun && events.length > 6 ? (
                    <li className="text-muted-foreground">+{events.length - 6} more</li>
                  ) : null}
                </ul>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
