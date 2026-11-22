import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema";
import { env, usingEmbeddedDatabase } from "@/lib/env";

/**
 * Database access layer.
 *
 * Production uses PostgreSQL over the `pg` driver (DATABASE_URL). When no
 * DATABASE_URL is configured, NicheScope runs against an embedded PostgreSQL
 * (PGlite) so the full application — migrations, seeds, queries, tests and the
 * local preview — works without external infrastructure. Both paths use the
 * same Drizzle schema and the same SQL migrations from ./drizzle.
 */
export type Database = NodePgDatabase<typeof schema>;

type GlobalDb = typeof globalThis & {
  __nichscopeDb?: Promise<Database>;
  __nichscopeDbInit?: Promise<void>;
  __nichscopeBootstrap?: Promise<void>;
  __nichscopePglite?: unknown;
};

const globalDb = globalThis as GlobalDb;

async function createDatabase(): Promise<Database> {
  if (!usingEmbeddedDatabase) {
    const { Pool } = await import("pg");
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const pool = new Pool({
      connectionString: env.DATABASE_URL,
      max: Number(process.env.PGPOOL_MAX ?? 10),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
    // A failed idle client should not crash the process.
    pool.on("error", (error) => {
      console.error("[db] idle client error", error);
    });
    return drizzle(pool, { schema, logger: false });
  }

  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  // The embedded engine is a local development fallback; keep bundlers from
  // tracing the entire project because of dynamic filesystem access.
  const dataDir = path.resolve(/* turbopackIgnore: true */ process.cwd(), env.PGLITE_DATA_DIR);
  await fs.mkdir(path.dirname(dataDir), { recursive: true });
  const client = new PGlite(dataDir);
  await client.waitReady;
  globalDb.__nichscopePglite = client;
  return drizzle(client, { schema }) as unknown as Database;
}

async function runMigrations(db: Database): Promise<void> {
  const path = await import("node:path");
  const migrationsFolder = path.join(process.cwd(), "drizzle");
  try {
    if (usingEmbeddedDatabase) {
      const { migrate } = await import("drizzle-orm/pglite/migrator");
      await migrate(db as never, { migrationsFolder });
    } else {
      const { migrate } = await import("drizzle-orm/node-postgres/migrator");
      await migrate(db, { migrationsFolder });
    }
  } catch (error) {
    console.error(
      "[db] Migration failed. Run `npm run db:migrate` to apply migrations.",
      error,
    );
    throw error;
  }
}

async function init(): Promise<Database> {
  const db = await createDatabase();
  const shouldMigrate =
    env.AUTO_MIGRATE !== "false" && env.NODE_ENV !== "test";
  if (shouldMigrate) {
    await runMigrations(db);
  } else if (env.AUTO_MIGRATE !== "false") {
    await runMigrations(db);
  }
  return db;
}

/** Returns the singleton database handle. */
export function getDb(): Promise<Database> {
  if (!globalDb.__nichscopeDb) {
    globalDb.__nichscopeDb = init().catch((error) => {
      globalDb.__nichscopeDb = undefined;
      throw error;
    });
  }
  return globalDb.__nichscopeDb;
}

/** Explicit hook used by scripts and tests to apply migrations. */
export async function migrateDatabase(): Promise<void> {
  const db = await getDb();
  await runMigrations(db);
}

export async function closeDatabase(): Promise<void> {
  const client = globalDb.__nichscopePglite as
    | { close?: () => Promise<void> }
    | undefined;
  if (client?.close) await client.close();
  globalDb.__nichscopeDb = undefined;
  globalDb.__nichscopePglite = undefined;
}

export { schema };
