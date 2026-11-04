import { auth } from "@clerk/tanstack-react-start/server";
import { redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

/**
 * Route guard for pages that need a signed-in user (the admin page). Runs on
 * the server in `beforeLoad`; sends anonymous visitors to the Clerk sign-in
 * page and back here afterwards. Everything else in the app stays public.
 */
export const requireSignedIn = createServerFn({ method: "GET" })
  .validator((input: unknown) => {
    const o = (input ?? {}) as { redirectTo?: string };
    return { redirectTo: typeof o.redirectTo === "string" ? o.redirectTo : "/" };
  })
  .handler(async ({ data }) => {
    const { isAuthenticated, userId } = await auth();
    if (!isAuthenticated) {
      throw redirect({ to: "/sign-in/$", search: { redirect_url: data.redirectTo } });
    }
    return { userId };
  });
