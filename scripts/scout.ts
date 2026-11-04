/**
 * Run the AI scout from the command line, outside any request timeout.
 *
 *   npm run scout -- restaurants
 *   npm run scout -- grocery
 *   npm run scout -- activities
 *   npm run scout -- all
 *
 * Needs DATABASE_URL and ANTHROPIC_API_KEY in .env.
 */
import "dotenv/config";
import { runScout } from "../src/server/scout";
import { prisma } from "../src/server/db";

const MAP = {
  restaurants: "RESTAURANTS",
  grocery: "GROCERY",
  activities: "ACTIVITIES",
} as const;

async function main() {
  const arg = (process.argv[2] ?? "").toLowerCase();
  const targets =
    arg === "all"
      ? (Object.values(MAP) as (typeof MAP)[keyof typeof MAP][])
      : arg in MAP
        ? [MAP[arg as keyof typeof MAP]]
        : null;
  if (!targets) {
    console.error("usage: npm run scout -- <restaurants|grocery|activities|all>");
    process.exitCode = 2;
    return;
  }
  for (const target of targets) {
    console.log(`[scout] ${target} — starting`);
    const result = await runScout(target);
    console.log(JSON.stringify(result, null, 2));
    if (!result.ok) process.exitCode = 1;
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
