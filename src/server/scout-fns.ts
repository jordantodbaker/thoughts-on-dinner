import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader, setResponseStatus } from "@tanstack/react-start/server";
import { z } from "zod";
import { runScout, type ScoutRunResult } from "./scout";

const input = z.object({
  target: z.enum(["RESTAURANTS", "GROCERY", "ACTIVITIES"]),
  /** Secret typed into the admin page. Vercel Cron sends it as a header instead. */
  secret: z.string().optional(),
});

export type RunScoutResponse = ScoutRunResult | { ok: false; error: string };

/**
 * Guarded by `CRON_SECRET`: accepts either `Authorization: Bearer <secret>`
 * (what Vercel Cron sends when the env var is set on the project) or an
 * explicit `secret` in the payload (the admin page). When the variable is
 * unset the guard is skipped outside production so local dev just works.
 */
export const runScoutFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) => input.parse(raw))
  .handler(async ({ data }): Promise<RunScoutResponse> => {
    const secret = process.env.CRON_SECRET;
    if (!secret) {
      if (process.env.NODE_ENV === "production") {
        setResponseStatus(500);
        return { ok: false, error: "CRON_SECRET is not configured" };
      }
    } else {
      const header = getRequestHeader("authorization") ?? "";
      const ok = header === `Bearer ${secret}` || data.secret === secret;
      if (!ok) {
        setResponseStatus(401);
        return { ok: false, error: "Unauthorized" };
      }
    }
    try {
      return await runScout(data.target);
    } catch (err) {
      setResponseStatus(500);
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });
