import { getDb } from "./client";
import { ensureBootstrapped } from "./bootstrap";
import type { Database } from "./client";

/**
 * Returns a migrated database with taxonomy + governance records present.
 * Seeding is attempted once per process and never overwrites user data.
 */
export async function getReadyDb(): Promise<Database> {
  const db = await getDb();
  await ensureBootstrapped();
  return db;
}
