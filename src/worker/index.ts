/**
 * NicheScope background worker.
 *
 * A persistent Node.js process that:
 *  - starts pg-boss against the managed PostgreSQL instance (durable scheduling,
 *    retries, concurrency limits);
 *  - drives the shared job ledger (`background_jobs`), which is also used by
 *    the embedded development runner;
 *  - exposes an HTTP health endpoint for the hosting platform;
 *  - shuts down gracefully on SIGTERM/SIGINT.
 *
 * Run with: npm run worker
 */
import { createServer } from "node:http";
import { PgBoss } from "pg-boss";
import { getDb, closeDatabase } from "@/lib/db/client";
import { migrateDatabase } from "@/lib/db/client";
import { seedDatabase } from "@/lib/db/seed";
import {
  ensureRecurringJobs,
  getJobStats,
  processDueJobs,
} from "@/lib/jobs/queue";
import { env, workerEnabled } from "@/lib/env";

const log = (level: "info" | "warn" | "error", message: string, extra?: unknown) => {
  console.log(
    JSON.stringify({
      level,
      service: "nichscope-worker",
      message,
      ...(extra ? { extra } : {}),
      at: new Date().toISOString(),
    }),
  );
};

const TICK_QUEUE = "nichscope.ledger";
const HEALTH_PORT = Number(process.env.WORKER_PORT ?? 3001);
const CONCURRENCY = env.WORKER_CONCURRENCY;

async function main() {
  if (!env.DATABASE_URL) {
    log(
      "error",
      "DATABASE_URL is required for the worker. The embedded development engine is only available inside the Next.js app.",
    );
    process.exit(1);
  }
  if (!workerEnabled) {
    log("warn", "WORKER_ENABLED is not true — starting anyway because the worker was invoked directly.");
  }

  log("info", "starting worker", { concurrency: CONCURRENCY });
  const db = await getDb();
  await migrateDatabase();
  await seedDatabase(db);

  const boss = new PgBoss({
    connectionString: env.DATABASE_URL,
    max: CONCURRENCY,
    schema: process.env.PGBOSS_SCHEMA ?? "public",
  });

  boss.on("error", (error: unknown) => log("error", "pg-boss error", error));

  await boss.start();
  await boss.createQueue(TICK_QUEUE).catch(() => undefined);

  let running = true;
  let ticking = false;

  const tick = async (source: string) => {
    if (ticking || !running) return;
    ticking = true;
    try {
      await ensureRecurringJobs(db);
      const processed = await processDueJobs(db, CONCURRENCY);
      if (processed > 0) log("info", "processed jobs", { processed, source });
    } catch (error) {
      log("error", "tick failed", error);
    } finally {
      ticking = false;
    }
  };

  await boss.work(TICK_QUEUE, async () => {
    await tick("pg-boss");
  });

  // pg-boss schedule triggers a ledger tick every minute.
  await boss.schedule(TICK_QUEUE, "* * * * *", {}, { tz: "UTC" });
  await tick("startup");

  const health = createServer(async (request, response) => {
    if (request.url?.startsWith("/health")) {
      try {
        const stats = await getJobStats(db);
        const healthy = running;
        response.writeHead(healthy ? 200 : 503, {
          "Content-Type": "application/json",
        });
        response.end(
          JSON.stringify({
            status: healthy ? "ok" : "stopping",
            service: "nichscope-worker",
            uptimeSeconds: Math.round(process.uptime()),
            queue: stats,
            concurrency: CONCURRENCY,
            timestamp: new Date().toISOString(),
          }),
        );
      } catch (error) {
        response.writeHead(500, { "Content-Type": "application/json" });
        response.end(
          JSON.stringify({
            status: "error",
            message: error instanceof Error ? error.message : "unknown",
          }),
        );
      }
      return;
    }
    response.writeHead(404).end();
  });

  health.listen(HEALTH_PORT, "0.0.0.0", () => {
    log("info", "worker health endpoint listening", { port: HEALTH_PORT });
  });

  const shutdown = async (signal: string) => {
    log("info", "shutting down", { signal });
    running = false;
    health.close();
    try {
      await boss.stop({ graceful: true });
    } catch (error) {
      log("error", "pg-boss stop failed", error);
    }
    await closeDatabase();
    process.exit(0);
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("unhandledRejection", (reason) => {
    log("error", "unhandled rejection", reason);
  });
}

main().catch((error) => {
  log("error", "worker failed to start", error);
  process.exit(1);
});
