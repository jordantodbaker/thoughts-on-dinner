import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { EmptyState, SectionHeading } from "~/components/cards";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { requireSignedIn } from "~/server/auth";
import { statusQueryOptions } from "~/server/board";
import { runScoutFn, type RunScoutResponse } from "~/server/scout-fns";

export const Route = createFileRoute("/admin")({
  // Signed-in users only; anonymous visitors are sent to /sign-in and back.
  beforeLoad: () => requireSignedIn({ data: { redirectTo: "/admin" } }),
  loader: ({ context }) => context.queryClient.ensureQueryData(statusQueryOptions()),
  component: AdminPage,
});

const TARGETS = [
  { key: "RESTAURANTS", label: "Restaurants", blurb: "Happy hours and weekly specials." },
  { key: "GROCERY", label: "Grocery", blurb: "Store programs and this week's ads." },
  { key: "ACTIVITIES", label: "Activities", blurb: "Next two weeks of events plus weekly nights." },
] as const;

function AdminPage() {
  const { data } = useSuspenseQuery(statusQueryOptions());
  const qc = useQueryClient();
  const [secret, setSecret] = useState("");
  const [last, setLast] = useState<RunScoutResponse | null>(null);

  const run = useMutation({
    mutationFn: (target: (typeof TARGETS)[number]["key"]) =>
      runScoutFn({ data: { target, secret: secret || undefined } }),
    onSuccess: (res) => {
      setLast(res);
      void qc.invalidateQueries();
    },
    onError: (err) => setLast({ ok: false, error: err instanceof Error ? err.message : String(err) }),
  });

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="text-sm text-muted-foreground">Data status and the AI scout</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Admin</h1>
      </div>

      <section className="grid gap-3 sm:grid-cols-3">
        <Stat label="Venues" value={data.counts.venues} />
        <Stat label="Deals" value={data.counts.deals} />
        <Stat label="Events" value={data.counts.events} />
      </section>

      <section>
        <SectionHeading
          title="Run the scout"
          hint={
            data.scoutEnabled
              ? "Each run searches the web with Claude and takes one to four minutes. Vercel Cron runs all three every Monday morning."
              : "ANTHROPIC_API_KEY is not set on the server, so the scout is disabled. The app runs on seed data."
          }
        />
        <div className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs text-muted-foreground">CRON_SECRET (required in production)</span>
            <input
              type="password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              className="h-9 max-w-sm rounded-md border bg-background px-2"
              autoComplete="off"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            {TARGETS.map((t) => (
              <Button
                key={t.key}
                disabled={!data.scoutEnabled || run.isPending}
                onClick={() => run.mutate(t.key)}
                title={t.blurb}
              >
                {run.isPending && run.variables === t.key ? "Running…" : `Refresh ${t.label}`}
              </Button>
            ))}
          </div>
          {last ? (
            <pre className="overflow-auto rounded-md bg-muted p-3 text-xs">
              {JSON.stringify(last, null, 2)}
            </pre>
          ) : null}
        </div>
      </section>

      <section>
        <SectionHeading title="Recent runs" count={data.runs.length} />
        {data.runs.length ? (
          <div className="overflow-x-auto rounded-2xl border bg-card">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/60 text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Started</th>
                  <th className="px-3 py-2 font-medium">Target</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Venues / deals / events</th>
                  <th className="px-3 py-2 font-medium">Searches</th>
                  <th className="px-3 py-2 font-medium">Tokens in / out</th>
                  <th className="px-3 py-2 font-medium">Summary</th>
                </tr>
              </thead>
              <tbody>
                {data.runs.map((r) => (
                  <tr key={r.id} className="border-t align-top">
                    <td className="whitespace-nowrap px-3 py-2">{new Date(r.startedAt).toLocaleString()}</td>
                    <td className="px-3 py-2">{r.target}</td>
                    <td className="px-3 py-2">
                      <Badge tone={r.status === "SUCCESS" ? "primary" : r.status === "FAILED" ? "accent" : "muted"}>
                        {r.status}
                      </Badge>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">
                      {r.venuesUpserted} / {r.dealsUpserted} / {r.eventsUpserted}
                    </td>
                    <td className="px-3 py-2">{r.searches}</td>
                    <td className="whitespace-nowrap px-3 py-2">
                      {r.inputTokens.toLocaleString()} / {r.outputTokens.toLocaleString()}
                    </td>
                    <td className="max-w-md px-3 py-2 text-muted-foreground">{r.error ?? r.summary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState>The scout hasn't run yet.</EmptyState>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold">{value.toLocaleString()}</div>
    </div>
  );
}
