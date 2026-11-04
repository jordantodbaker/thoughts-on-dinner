# Thoughts on Dinner

Tonight's restaurant specials, this week's grocery deals and date-night
activities around **Bellingham, WA** — with a "dinner → something fun" pairing
for every night of the week.

| Page | What it shows |
| --- | --- |
| `/` Tonight | A suggested dinner + activity pairing (shuffle for another), then everything still on today: restaurant specials, things to do, day-specific grocery deals. Specials that already ended are hidden after the page loads. |
| `/week` This week | Seven-day strip with per-day counts, the selected day in full, and an at-a-glance grid of the whole week. Filter by restaurants / activities / grocery and by activity type. Browse earlier or later weeks. |
| `/date-night` | Every dinner + activity pairing for a chosen day, ranked by neighborhood match and timing. Filter by activity type (ice skating, pinball, bowling, darts, dancing, live music, trivia, karaoke, comedy, theater, movies, games…). "Surprise me" picks one. |
| `/grocery` | Every store with its weekly-ad link, standing deal programs (Safeway $5 Friday, Co-op Fresh Deals, Fred Meyer digital deals, Costco booklet, Farmers Market…) and dated ad windows. |
| `/admin` | Row counts, scout run history, and buttons to run the AI scout per target. |

## Stack

Same shape as EPC Manager: [TanStack Start](https://tanstack.com/start) (React 19,
server functions, SSR) + TanStack Query, Tailwind v4, Prisma 7 + Postgres,
deployed to Vercel through the Node adapter in [`api/handler.js`](api/handler.js).
The weekly data refresh uses the Claude API (Opus 5.5 with the server-side
web-search tool, then structured outputs).

```
src/
  routes/            file-based routes (index, week, date-night, grocery, admin, api.cron.scout.$target)
  components/        cards, pairing hero, day strip, nav, shadcn-style ui/
  lib/               pure logic: dates (America/Los_Angeles), schedule matching, pairing scorer, categories
  server/            db.ts (Prisma client), board.ts (server fns + query options), scout.ts (Claude), scout-fns.ts
prisma/
  schema.prisma      Venue / Deal / Event / ScoutRun
  migrations/        0001_init (generated from the schema)
  seed.ts            idempotent upsert from seed-data/*.json
  seed-data/         restaurants.json, grocery.json, activities.json — hand-researched Nov 2026
scripts/
  scout.ts           run the AI scout from a terminal (no request timeout)
  verify-local.ts    in-memory PGlite: migrate + seed + build the week board, asserts nothing is empty
```

## Data model

- **Venue** — restaurant, grocery store or activity venue (one table; a brewery
  that also hosts trivia is one row). Slug-keyed so seeds and the scout merge.
- **Deal** — a special at a restaurant or grocer. `days[]` (empty = daily),
  optional `startTime`/`endTime`, optional `validFrom`/`validTo` for dated ads.
- **Event** — recurring (`days[]`) or one-off (`date`) activity, with a category.
- **ScoutRun** — one row per AI refresh: status, counts, tokens, searches.

Every row carries `confidence` (HIGH = the venue's own site confirms it,
MEDIUM = third-party listing), `source` (SEED / AI / MANUAL), `sourceUrl` and
`lastVerifiedAt`. The UI shows a colored dot for confidence and a "source" link.

## Run it locally

```bash
pnpm install
cp .env.example .env        # DATABASE_URL defaults to pglite://memory
pnpm dev                    # http://localhost:3000
```

With `DATABASE_URL=pglite://memory` the app boots an in-process Postgres,
applies the migration and loads the seed data on the first request. Nothing to
install. Use `pglite://./.pglite` to keep the data between restarts.

Against a real Postgres:

```bash
DATABASE_URL="postgresql://..." pnpm db:deploy   # apply prisma/migrations
DATABASE_URL="postgresql://..." pnpm db:seed     # load seed-data/*.json (safe to re-run)
```

Other scripts: `pnpm test` (unit tests for dates, schedule, pairing),
`pnpm build` (Vite client + SSR bundles, then `tsc --noEmit`),
`pnpm exec tsx scripts/verify-local.ts` (end-to-end check with no database).

## The AI scout

`src/server/scout.ts` refreshes one target at a time — `RESTAURANTS`,
`GROCERY` or `ACTIVITIES`:

1. **Research**: `claude-opus-5-5` with the `web_search_20260209` server tool
   (location hint: Bellingham, WA), streamed, resuming `pause_turn`, with
   server-side refusal fallbacks enabled. It gets the list of venues already in
   the database so it verifies and extends rather than duplicates.
2. **Extract**: a second call with `output_config.format` (Zod schema) turns the
   notes into venues / deals / events / closed venues / summary.
3. **Apply**: upsert by slug and (venue, title[, date]); stamp `lastVerifiedAt`;
   skip anything already in the past; soft-deactivate confirmed-closed venues.
   Nothing is deleted.

Ways to run it:

- **Vercel Cron** (configured in `vercel.json`): the three targets run every
  Monday morning (13:00, 13:20, 13:40 UTC). Set `CRON_SECRET` on the project;
  Vercel sends it as a bearer token and the route checks it.
- **Admin page** `/admin`: paste the secret, click a target.
- **Terminal**: `pnpm scout -- restaurants|grocery|activities|all` — no
  timeout, handy for the first big run.

Each run is roughly 15–25 web searches; expect a few dollars per full
three-target refresh at Opus 5.5 rates. Without `ANTHROPIC_API_KEY` the scout
is disabled and the app runs on seed data.

## Deploy to Vercel

1. Create a Postgres database (Neon works well; any `postgresql://` URL does).
2. Import the repo in Vercel. The framework preset can stay "Other";
   `vercel.json` sets the build command (`npm run build`), output directory
   (`dist/client`), the catch-all rewrite to `api/handler.js`, function
   limits (1024 MB, 300 s — the scout needs the long timeout) and the crons.
3. Environment variables: `DATABASE_URL`, `ANTHROPIC_API_KEY` (optional),
   `CRON_SECRET` (needed for cron and the admin buttons in production).
4. Apply the schema and seed once from your machine:
   `DATABASE_URL=... pnpm db:deploy && DATABASE_URL=... pnpm db:seed`.
5. Deploy. `/api/healthcheck` pings the database without loading the app bundle.

## Editing the seed data

`prisma/seed-data/*.json` is the hand-curated baseline. Venue names are the
join key: a restaurant in `restaurants.json` that also hosts events in
`activities.json` must use the **same name** so both land on one venue.
Re-run `pnpm db:seed` after editing; it upserts and never duplicates.
`scripts/verify-local.ts` warns about events whose venue isn't in the venues
list and about days with nothing on them.
