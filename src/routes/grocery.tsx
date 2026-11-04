import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ExternalLink, MapPin } from "lucide-react";
import { DealCard, EmptyState, SectionHeading } from "~/components/cards";
import { Badge } from "~/components/ui/badge";
import { formatLong } from "~/lib/dates";
import { groceryStoresQueryOptions, weekBoardQueryOptions } from "~/server/board";

export const Route = createFileRoute("/grocery")({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(groceryStoresQueryOptions()),
      context.queryClient.ensureQueryData(weekBoardQueryOptions()),
    ]),
  component: GroceryPage,
});

function GroceryPage() {
  const { data: stores } = useSuspenseQuery(groceryStoresQueryOptions());
  const { data: board } = useSuspenseQuery(weekBoardQueryOptions());
  const today = board.days[0];

  const withDeals = stores.filter((s) => s.deals.length > 0);
  const without = stores.filter((s) => s.deals.length === 0);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="text-sm text-muted-foreground">Bellingham grocery stores and markets</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Grocery deals</h1>
      </div>

      <section>
        <SectionHeading
          title={`On today, ${formatLong(today.date)}`}
          count={today.groceryDeals.length}
          hint="Day-specific deals plus any dated ad windows that include today."
        />
        {today.groceryDeals.length ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {today.groceryDeals.map((d) => (
              <DealCard key={d.id} deal={d} />
            ))}
          </div>
        ) : (
          <EmptyState>No grocery deal is specific to today.</EmptyState>
        )}
      </section>

      <section>
        <SectionHeading title="Stores" count={stores.length} hint="Standing programs, weekly ads and member deals." />
        <div className="grid gap-4 md:grid-cols-2">
          {withDeals.map(({ venue, deals }) => (
            <article key={venue.id} className="rounded-2xl border bg-card p-4">
              <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold">
                    {venue.website ? (
                      <a href={venue.website} target="_blank" rel="noreferrer" className="hover:underline">
                        {venue.name}
                      </a>
                    ) : (
                      venue.name
                    )}
                  </h3>
                  <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                    {venue.neighborhood ? (
                      <span className="inline-flex items-center gap-0.5">
                        <MapPin className="size-3" />
                        {venue.neighborhood}
                      </span>
                    ) : null}
                    {venue.address ? <span>{venue.address}</span> : null}
                  </div>
                </div>
                {venue.weeklyAdUrl ? (
                  <a
                    href={venue.weeklyAdUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-md bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground no-underline"
                  >
                    Weekly ad <ExternalLink className="size-3" />
                  </a>
                ) : null}
              </div>
              {venue.description ? (
                <p className="mb-2 text-xs text-muted-foreground">{venue.description}</p>
              ) : null}
              <div className="flex flex-col gap-2">
                {deals.map((d) => (
                  <DealCard key={d.id} deal={d} compact />
                ))}
              </div>
            </article>
          ))}
        </div>

        {without.length ? (
          <div className="mt-6">
            <h3 className="mb-2 text-sm font-semibold text-muted-foreground">
              Other stores (no standing deal program)
            </h3>
            <div className="flex flex-wrap gap-2">
              {without.map(({ venue }) => (
                <Badge key={venue.id} className="px-3 py-1 text-xs" title={venue.description ?? undefined}>
                  {venue.website ? (
                    <a href={venue.website} target="_blank" rel="noreferrer" className="hover:underline">
                      {venue.name}
                    </a>
                  ) : (
                    venue.name
                  )}
                  {venue.neighborhood ? <span className="opacity-70">· {venue.neighborhood}</span> : null}
                </Badge>
              ))}
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
