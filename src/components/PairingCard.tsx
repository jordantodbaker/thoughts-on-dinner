import { ArrowRight, Shuffle } from "lucide-react";
import { CATEGORY_META } from "~/lib/categories";
import { formatTimeRange } from "~/lib/dates";
import type { Pairing } from "~/lib/pairing";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";

/** The hero "tonight's plan": one dinner deal → one activity, with a shuffle. */
export function PairingCard({
  pairing,
  onShuffle,
  total,
}: {
  pairing: Pairing;
  onShuffle?: () => void;
  total?: number;
}) {
  const { deal, event, reasons } = pairing;
  const meta = CATEGORY_META[event.category];
  return (
    <section className="rounded-2xl border bg-gradient-to-br from-primary/8 via-card to-accent/10 p-4 shadow-sm sm:p-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {reasons.map((r) => (
            <Badge key={r} tone="primary">
              {r}
            </Badge>
          ))}
        </div>
        {onShuffle ? (
          <Button variant="outline" size="sm" onClick={onShuffle}>
            <Shuffle />
            Shuffle{typeof total === "number" ? ` (${total})` : ""}
          </Button>
        ) : null}
      </div>
      <div className="grid items-stretch gap-3 sm:grid-cols-[1fr_auto_1fr]">
        <Step
          kicker="Dinner"
          title={deal.title}
          venue={deal.venue.name}
          where={deal.venue.neighborhood}
          when={formatTimeRange(deal.startTime, deal.endTime) || "any time"}
          detail={deal.priceText ?? deal.description}
          href={deal.venue.website ?? deal.sourceUrl}
        />
        <div className="hidden items-center sm:flex">
          <ArrowRight className="size-6 text-muted-foreground" />
        </div>
        <Step
          kicker={`${meta.emoji} ${meta.label}`}
          title={event.title}
          venue={event.venue.name}
          where={event.venue.neighborhood}
          when={formatTimeRange(event.startTime, event.endTime) || "open hours"}
          detail={event.priceText ?? event.description}
          href={event.sourceUrl ?? event.venue.website}
        />
      </div>
    </section>
  );
}

function Step({
  kicker,
  title,
  venue,
  where,
  when,
  detail,
  href,
}: {
  kicker: string;
  title: string;
  venue: string;
  where: string | null;
  when: string;
  detail: string | null;
  href: string | null;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-xl bg-card/80 p-4">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {kicker}
      </div>
      <div className="text-base font-semibold leading-6">{title}</div>
      <div className="text-sm">
        {href ? (
          <a href={href} target="_blank" rel="noreferrer" className="hover:underline">
            {venue}
          </a>
        ) : (
          venue
        )}
        {where ? <span className="text-muted-foreground"> · {where}</span> : null}
      </div>
      <div className="text-sm text-muted-foreground">{when}</div>
      {detail ? <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{detail}</p> : null}
    </div>
  );
}
