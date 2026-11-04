import { ExternalLink, MapPin } from "lucide-react";
import { CATEGORY_META } from "~/lib/categories";
import { describeDays, formatMonthDay, formatTimeRange } from "~/lib/dates";
import type { DealItem, EventItem, VenueSummary } from "~/lib/types";
import { cn } from "~/lib/utils";
import { Badge } from "./ui/badge";

function VenueLine({ venue }: { venue: VenueSummary }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
      {venue.website ? (
        <a
          href={venue.website}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-foreground hover:underline"
        >
          {venue.name}
        </a>
      ) : (
        <span className="font-medium text-foreground">{venue.name}</span>
      )}
      {venue.cuisine ? <span>· {venue.cuisine}</span> : null}
      {venue.neighborhood ? (
        <span className="inline-flex items-center gap-0.5">
          <MapPin className="size-3" />
          {venue.neighborhood}
        </span>
      ) : null}
    </div>
  );
}

function SourceLink({ url }: { url: string | null }) {
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
      title="Open the source"
    >
      <ExternalLink className="size-3" />
      source
    </a>
  );
}

function ConfidenceDot({ level }: { level: DealItem["confidence"] }) {
  const tone =
    level === "HIGH" ? "bg-emerald-500" : level === "MEDIUM" ? "bg-amber-400" : "bg-stone-400";
  const label =
    level === "HIGH"
      ? "Confirmed by the venue"
      : level === "MEDIUM"
        ? "From a third-party listing"
        : "Unverified";
  return <span className={cn("inline-block size-2 rounded-full", tone)} title={label} aria-label={label} />;
}

export function DealCard({ deal, compact = false }: { deal: DealItem; compact?: boolean }) {
  const when = formatTimeRange(deal.startTime, deal.endTime);
  const isDated = Boolean(deal.validFrom || deal.validTo);
  return (
    <article
      className={cn(
        "flex flex-col gap-1.5 rounded-xl border bg-card p-3 shadow-xs",
        compact && "p-2.5",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold leading-5">{deal.title}</h3>
        <ConfidenceDot level={deal.confidence} />
      </div>
      <VenueLine venue={deal.venue} />
      {!compact && deal.description ? (
        <p className="text-xs leading-5 text-muted-foreground">{deal.description}</p>
      ) : null}
      <div className="flex flex-wrap items-center gap-1.5">
        {when ? <Badge tone="primary">{when}</Badge> : null}
        <Badge>{describeDays(deal.days)}</Badge>
        {deal.priceText ? <Badge tone="accent">{deal.priceText}</Badge> : null}
        {isDated ? (
          <Badge>
            {deal.validFrom ? formatMonthDay(deal.validFrom) : "now"}
            {" – "}
            {deal.validTo ? formatMonthDay(deal.validTo) : "ongoing"}
          </Badge>
        ) : null}
        <span className="ml-auto">
          <SourceLink url={deal.sourceUrl} />
        </span>
      </div>
    </article>
  );
}

export function EventCard({ event, compact = false }: { event: EventItem; compact?: boolean }) {
  const meta = CATEGORY_META[event.category];
  const when = formatTimeRange(event.startTime, event.endTime);
  return (
    <article
      className={cn(
        "flex flex-col gap-1.5 rounded-xl border bg-card p-3 shadow-xs",
        compact && "p-2.5",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold leading-5">
          <span className="mr-1" aria-hidden>
            {meta.emoji}
          </span>
          {event.title}
        </h3>
        <ConfidenceDot level={event.confidence} />
      </div>
      <VenueLine venue={event.venue} />
      {!compact && event.description ? (
        <p className="text-xs leading-5 text-muted-foreground">{event.description}</p>
      ) : null}
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge tone="custom" className={meta.tone}>
          {meta.label}
        </Badge>
        {when ? <Badge tone="primary">{when}</Badge> : null}
        {event.recurring ? (
          <Badge>{describeDays(event.days)}</Badge>
        ) : event.date ? (
          <Badge tone="accent">{formatMonthDay(event.date)} · one night</Badge>
        ) : null}
        {event.priceText ? <Badge>{event.priceText}</Badge> : null}
        <span className="ml-auto">
          <SourceLink url={event.sourceUrl} />
        </span>
      </div>
    </article>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}

export function SectionHeading({
  title,
  count,
  hint,
  children,
}: {
  title: string;
  count?: number;
  hint?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">
          {title}
          {typeof count === "number" ? (
            <span className="ml-2 text-sm font-normal text-muted-foreground">{count}</span>
          ) : null}
        </h2>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </div>
      {children}
    </div>
  );
}
