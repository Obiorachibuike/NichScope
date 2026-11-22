import { sql } from "drizzle-orm";
import { json } from "@/lib/api";
import { getReadyDb } from "@/lib/db/ready";
import { demoMode, usingEmbeddedDatabase } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Lightweight public liveness probe — no internal details or secrets. */
export async function GET() {
  const started = Date.now();
  let database = false;
  try {
    const db = await getReadyDb();
    await db.execute(sql`select 1`);
    database = true;
  } catch {
    database = false;
  }
  return json(
    {
      status: database ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      database,
      latencyMs: Date.now() - started,
      demoMode,
      databaseEngine: usingEmbeddedDatabase ? "embedded" : "postgres",
    },
    { status: database ? 200 : 503 },
  );
}
