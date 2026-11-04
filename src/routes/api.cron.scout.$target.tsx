import { createFileRoute, notFound } from "@tanstack/react-router";
import { runScoutFn } from "~/server/scout-fns";

const TARGETS = {
  restaurants: "RESTAURANTS",
  grocery: "GROCERY",
  activities: "ACTIVITIES",
} as const;

/**
 * HTTP entry point for Vercel Cron (see vercel.json `crons`). The work runs in
 * the loader, server-side, for the unauthenticated GET the scheduler sends;
 * the server fn checks the `Authorization: Bearer <CRON_SECRET>` header Vercel
 * attaches. Opening the URL by hand renders the JSON result.
 */
export const Route = createFileRoute("/api/cron/scout/$target")({
  loader: async ({ params }) => {
    const target = TARGETS[params.target as keyof typeof TARGETS];
    if (!target) throw notFound();
    return runScoutFn({ data: { target } });
  },
  component: () => {
    const result = Route.useLoaderData();
    return <pre className="text-xs">{JSON.stringify(result, null, 2)}</pre>;
  },
});
