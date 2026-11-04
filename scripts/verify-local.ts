/**
 * End-to-end check that needs no Postgres server: spins up an in-memory
 * PGlite, applies prisma/migrations, runs the real seed, then builds the
 * week board and tonight's pairings exactly the way the server functions do.
 *
 *   pnpm exec tsx scripts/verify-local.ts
 *
 * Exits non-zero if anything looks wrong (empty days, orphaned deals, etc.).
 */
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { PrismaPGlite } from "pglite-prisma-adapter";

// board.ts creates the production client at import time from DATABASE_URL;
// give it something syntactically valid (nothing connects until a query).
process.env.DATABASE_URL ??= "postgresql://verify:verify@127.0.0.1:5432/verify";

const { PrismaClient } = await import("../src/generated/prisma/client");
const { seedDatabase } = await import("../prisma/seed");
const { buildDayBoard, loadActive } = await import("../src/server/board-data");
const { buildPairings } = await import("../src/lib/pairing");
const { todayIso, weekDates, formatShort } = await import("../src/lib/dates");

const pg = new PGlite();
const migration = readFileSync("prisma/migrations/0001_init/migration.sql", "utf8");
await pg.exec(migration);

const prisma = new PrismaClient({ adapter: new PrismaPGlite(pg) });
const problems: string[] = [];

const counts = await seedDatabase(prisma);
console.log("[verify] seed:", counts);

// Re-run the seed to prove it's idempotent.
const again = await seedDatabase(prisma);
const totalVenues = await prisma.venue.count();
const totalDeals = await prisma.deal.count();
const totalEvents = await prisma.event.count();
console.log(`[verify] rows after second seed: ${totalVenues} venues, ${totalDeals} deals, ${totalEvents} events`);
if (again.deals !== counts.deals || again.events !== counts.events) problems.push("second seed changed counts");
if (totalDeals !== counts.deals) problems.push(`deal rows (${totalDeals}) != seeded deals (${counts.deals}) — duplicates?`);
if (totalEvents !== counts.events) problems.push(`event rows (${totalEvents}) != seeded events (${counts.events}) — duplicates?`);

// Venues with neither deals nor events are dead weight on the board.
const lonely = await prisma.venue.findMany({
  where: { deals: { none: {} }, events: { none: {} } },
  select: { name: true, type: true },
});
if (lonely.length) console.log("[verify] venues with no deals/events:", lonely.map((v) => `${v.name} (${v.type})`).join("; "));

// Activity venues that were created bare because an event referenced an unknown name.
const bare = await prisma.venue.findMany({ where: { address: null, type: "ACTIVITY" }, select: { name: true } });
if (bare.length) problems.push(`bare activity venues (add to activities.json): ${bare.map((v) => v.name).join(", ")}`);

const { dealItems, eventItems } = await loadActive(prisma);
const today = todayIso();
console.log(`\n[verify] week starting ${today}`);
for (const date of weekDates(today)) {
  const day = buildDayBoard(date, dealItems, eventItems);
  const pairings = buildPairings(day.restaurantDeals, day.events);
  console.log(
    `  ${formatShort(date).padEnd(12)} food ${String(day.restaurantDeals.length).padStart(2)}  grocery ${String(day.groceryDeals.length).padStart(2)}  fun ${String(day.events.length).padStart(2)}  pairings ${String(pairings.length).padStart(2)}` +
      (pairings[0] ? `  → ${pairings[0].deal.venue.name} + ${pairings[0].event.title}` : ""),
  );
  if (day.restaurantDeals.length === 0) problems.push(`${date}: no restaurant deals`);
  if (day.events.length === 0) problems.push(`${date}: no events`);
  if (pairings.length === 0) problems.push(`${date}: no pairings`);
}

// Spot-check: a dated event must only appear on its date.
const dated = eventItems.find((e) => !e.recurring && e.date);
if (dated) {
  const onDay = buildDayBoard(dated.date!, dealItems, eventItems).events.some((e) => e.id === dated.id);
  const offDay = buildDayBoard(
    dated.date! === today ? weekDates(today)[1] : today,
    dealItems,
    eventItems,
  ).events.some((e) => e.id === dated.id);
  if (!onDay || offDay) problems.push(`dated event "${dated.title}" placed on the wrong day`);
}

await prisma.$disconnect();
await pg.close();

if (problems.length) {
  console.error("\n[verify] PROBLEMS:\n - " + problems.join("\n - "));
  process.exitCode = 1;
} else {
  console.log("\n[verify] OK");
}
