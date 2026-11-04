/// <reference types="vite/client" />
import type { QueryClient } from "@tanstack/react-query";
import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
} from "@tanstack/react-router";
import * as React from "react";
import { DefaultCatchBoundary } from "~/components/DefaultCatchBoundary";
import { NotFound } from "~/components/NotFound";
import { Nav } from "~/components/Nav";
import appCss from "~/styles/app.css?url";

const ReactQueryDevtools = import.meta.env.DEV
  ? React.lazy(() =>
      import("@tanstack/react-query-devtools").then((m) => ({
        default: m.ReactQueryDevtools,
      })),
    )
  : () => null;
const TanStackRouterDevtools = import.meta.env.DEV
  ? React.lazy(() =>
      import("@tanstack/react-router-devtools").then((m) => ({
        default: m.TanStackRouterDevtools,
      })),
    )
  : () => null;

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Thoughts on Dinner — Bellingham deals & date nights" },
      {
        name: "description",
        content:
          "Tonight's restaurant specials, this week's grocery deals and date-night activities around Bellingham, WA.",
      },
      { name: "theme-color", content: "#f8f4ec" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "manifest", href: "/site.webmanifest" },
    ],
  }),
  errorComponent: (props) => (
    <RootDocument>
      <DefaultCatchBoundary {...props} />
    </RootDocument>
  ),
  notFoundComponent: () => <NotFound />,
  component: RootComponent,
});

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  );
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body className="min-h-screen">
        <Nav />
        <main className="mx-auto w-full max-w-6xl px-4 pb-16 pt-6 sm:px-6">{children}</main>
        <footer className="mx-auto max-w-6xl px-4 pb-8 text-xs text-muted-foreground sm:px-6">
          Deals and events change without notice — tap a source link and confirm before you head
          out. Centered on Bellingham, WA.
        </footer>
        {import.meta.env.DEV ? (
          <React.Suspense>
            <ReactQueryDevtools buttonPosition="bottom-left" />
            <TanStackRouterDevtools position="bottom-right" />
          </React.Suspense>
        ) : null}
        <Scripts />
      </body>
    </html>
  );
}
