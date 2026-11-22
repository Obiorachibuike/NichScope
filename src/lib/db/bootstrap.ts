import { getDb } from "./client";
import { seedDatabase, type SeedSummary } from "./seed";
import { sql } from "drizzle-orm";
import { categories } from "./schema";

/**
 * Ensures the database is migrated (handled by getDb) and contains the
 * taxonomy + data-source governance records. Safe to call concurrently: the
 * promise is memoised per process.
 */
type GlobalBootstrap = typeof globalThis & {
  __nichscopeSeedPromise?: Promise<SeedSummary>;
};

const g = globalThis as GlobalBootstrap;

async function bootstrap(): Promise<SeedSummary> {
  const db = await getDb();
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(categories);
  if ((row?.count ?? 0) === 0) {
    return seedDatabase(db);
  }
  return {
    categories: row?.count ?? 0,
    niches: 0,
    keywords: 0,
    dataSources: 0,
    metrics: 0,
    rankings: 0,
    channels: 0,
    videos: 0,
    users: 0,
    demoData: process.env.DEMO_MODE !== "false",
  };
}

export function ensureBootstrapped(): Promise<SeedSummary> {
  if (!g.__nichscopeSeedPromise) {
    g.__nichscopeSeedPromise = bootstrap().catch((error) => {
      g.__nichscopeSeedPromise = undefined;
      throw error;
    });
  }
  return g.__nichscopeSeedPromise;
}
