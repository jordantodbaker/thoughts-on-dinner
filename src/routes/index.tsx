import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { DealCard, EmptyState, EventCard, SectionHeading } from "~/components/cards";
import { CategoryChips } from "~/components/CategoryChips";
import { PairingCard } from "~/components/PairingCard";
import { Slideshow } from "~/components/Slideshow";
import { CollapsibleList } from "~/components/CollapsibleList";
import { Button } from "~/components/ui/button";
import { ACTIVITY_CATEGORIES, isActivityCategory } from "~/lib/categories";
import { formatLong, nowHHMM } from "~/lib/dates";
import { buildPairings, pickPairing } from "~/lib/pairing";
import { hasEnded, isDaySpecific } from "~/lib/schedule";
import { weekBoardQueryOptions } from "~/server/board";

const searchSchema = z.object({
  /** Activity type filter for "Things to do" (and tonight's pairing). */
  type: z.string().optional().catch(undefined),
});

export const Route = createFileRoute("/")({
  validateSearch: searchSchema,
  loader: ({ context }) => context.queryClient.ensureQueryData(weekBoardQueryOptions()),
  component: TonightPage,
});

function TonightPage() {
  const { data: board } = useSuspenseQuery(weekBoardQueryOptions());
  const today = board.days[0];
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const category = isActivityCategory(search.type) ? search.type : null;
  const setCategory = (type: string | null) =>
    navigate({ search: { type: type ?? undefined }, replace: true });

  // "Still on tonight" filtering uses the browser clock, applied after mount
  // so the server-rendered HTML and the first client render agree.
  const [now, setNow] = useState<string | null>(null);
  useEffect(() => {
    setNow(nowHHMM());
    const id = setInterval(() => setNow(nowHHMM()), 60_000);
    return () => clearInterval(id);
  }, []);
  const [showPast, setShowPast] = useState(false);

  const liveDeals = useMemo(
    () => today.restaurantDeals.filter((d) => showPast || !now || !hasEnded(d, now)),
    [today.restaurantDeals, now, showPast],
  );
  const liveEvents = useMemo(
    () =>
      today.events.filter(
        (e) => (showPast || !now || !hasEnded(e, now)) && (!category || e.category === category),
      ),
    [today.events, now, showPast, category],
  );
  // Chips only for types that are on tonight (ignoring the active filter).
  const availableCategories = useMemo(() => {
    const present = new Set(
      today.events.filter((e) => showPast || !now || !hasEnded(e, now)).map((e) => e.category),
    );
    return ACTIVITY_CATEGORIES.filter((c) => present.has(c));
  }, [today.events, now, showPast]);
  const hiddenCount =
    today.restaurantDeals.length -
    liveDeals.length +
    (today.events.filter((e) => !category || e.category === category).length - liveEvents.length);

  const groceryToday = useMemo(() => today.groceryDeals.filter(isDaySpecific), [today.groceryDeals]);

  const pairings = useMemo(() => buildPairings(liveDeals, liveEvents), [liveDeals, liveEvents]);
  const [seed, setSeed] = useState(0);
  const pairing = pickPairing(pairings, seed);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-start justify-between gap-4">
        <div className="pt-1">
          <p className="text-sm text-muted-foreground">{formatLong(today.date)} · Bellingham, WA</p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            What's good tonight?
          </h1>
        </div>
        {/* On phones the photos sit beside the heading; wider screens get them next to the plan. */}
        <Slideshow className="w-28 shrink-0 sm:hidden" />
      </div>

      <div className="flex items-stretch gap-4">
        <div className="min-w-0 flex-1">
          {pairing ? (
            <PairingCard
              pairing={pairing}
              total={pairings.length}
              onShuffle={() => setSeed((s) => s + 1)}
            />
          ) : (
            <EmptyState>
              No dinner-plus-activity pairing left for tonight.{" "}
              <Link to="/date-night" className="underline">
                Plan another night →
              </Link>
            </EmptyState>
          )}
        </div>
        <Slideshow className="hidden w-44 shrink-0 sm:block sm:aspect-auto lg:w-56" />
      </div>

      {hiddenCount > 0 || showPast ? (
        <div className="-mt-4 flex items-center gap-2 text-xs text-muted-foreground">
          {showPast
            ? "Showing everything today, including specials that already ended."
            : `${hiddenCount} already wrapped up for today.`}
          <Button variant="link" size="sm" className="h-auto p-0" onClick={() => setShowPast((v) => !v)}>
            {showPast ? "Hide ended" : "Show anyway"}
          </Button>
        </div>
      ) : null}

      <section>
        <SectionHeading title="Restaurant specials" count={liveDeals.length} hint="Happy hours and day-of-week deals on today." />
        {liveDeals.length ? (
          <CollapsibleList items={liveDeals.length} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {liveDeals.map((d) => (
              <DealCard key={d.id} deal={d} />
            ))}
          </CollapsibleList>
        ) : (
          <EmptyState>Nothing left today. Check the week view for tomorrow.</EmptyState>
        )}
      </section>

      <section>
        <SectionHeading title="Things to do" count={liveEvents.length} hint="Tonight's activities and events." />
        <CategoryChips
          className="mb-3"
          categories={availableCategories}
          selected={category}
          onSelect={setCategory}
        />
        {liveEvents.length ? (
          <CollapsibleList items={liveEvents.length} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {liveEvents.map((e) => (
              <EventCard key={e.id} event={e} />
            ))}
          </CollapsibleList>
        ) : (
          <EmptyState>
            {category ? (
              <>
                Nothing of that type left tonight.{" "}
                <Button variant="link" size="sm" className="h-auto p-0" onClick={() => setCategory(null)}>
                  Show everything
                </Button>
              </>
            ) : (
              "No activities listed for tonight."
            )}
          </EmptyState>
        )}
      </section>

      <section>
        <SectionHeading title="Grocery today" count={groceryToday.length} hint="Day-of-week store deals and this week's ads. Standing loyalty programs are on the grocery page.">
          <Link to="/grocery" className="text-sm text-primary hover:underline">
            All stores →
          </Link>
        </SectionHeading>
        {groceryToday.length ? (
          <CollapsibleList items={groceryToday.length} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {groceryToday.map((d) => (
              <DealCard key={d.id} deal={d} compact />
            ))}
          </CollapsibleList>
        ) : (
          <EmptyState>No grocery deals specific to today.</EmptyState>
        )}
      </section>
    </div>
  );
}
