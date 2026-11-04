import { readFileSync } from "node:fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "~/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * `DATABASE_URL=pglite://memory` (or `pglite://./some/dir`) runs the app on an
 * in-process Postgres with the schema applied and the seed data loaded — no
 * server to install, nothing to provision. Dev-only: the packages are
 * devDependencies and the import below is dynamic, so a production bundle
 * never touches them.
 */
async function createPgliteClient(url: string): Promise<PrismaClient> {
  const [{ PGlite }, { PrismaPGlite }] = await Promise.all([
    import("@electric-sql/pglite"),
    import("pglite-prisma-adapter"),
  ]);
  const target = url.slice("pglite:".length).replace(/^\/\//, "");
  const pg = target && target !== "memory" ? new PGlite(target) : new PGlite();
  const client = new PrismaClient({ adapter: new PrismaPGlite(pg) });

  const [{ exists }] = await pg.query<{ exists: boolean }>(
    "select exists (select 1 from information_schema.tables where table_name = 'Venue') as exists",
  ).then((r) => r.rows);
  if (!exists) {
    console.log("[db] pglite: applying prisma/migrations/0001_init");
    await pg.exec(readFileSync("prisma/migrations/0001_init/migration.sql", "utf8"));
  }
  if ((await client.venue.count()) === 0) {
    console.log("[db] pglite: loading seed data");
    const { seedDatabase } = await import("../../prisma/seed");
    await seedDatabase(client);
  }
  return client;
}

async function createClient(): Promise<PrismaClient> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set — copy .env.example to .env. Use pglite://memory for a zero-setup dev database.",
    );
  }
  if (connectionString.startsWith("pglite:")) return createPgliteClient(connectionString);

  // Modest pool: this is a serverless deployment, and the whole board is a
  // handful of statements. Keep idle connections for a couple of minutes so
  // a user clicking around doesn't pay a TLS handshake on every navigation.
  const adapter = new PrismaPg({
    connectionString,
    max: 4,
    idleTimeoutMillis: 120_000,
    connectionTimeoutMillis: 10_000,
  });
  return new PrismaClient({ adapter, log: ["warn", "error"] });
}

export const prisma: PrismaClient = globalForPrisma.prisma ?? (await createClient());

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
