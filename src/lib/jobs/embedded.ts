import { getReadyDb } from "@/lib/db/ready";
import { ensureRecurringJobs, processDueJobs } from "./queue";
import { workerEmbedded } from "@/lib/env";

/**
 * Embedded job runner for local development and preview deployments where a
 * separate worker process is not running. In production the dedicated
 * `npm run worker` process (pg-boss) drives the same ledger.
 */

type GlobalRunner = typeof globalThis & {
  __nichscopeRunner?: ReturnType<typeof setInterval>;
  __nichscopeRunnerBusy?: boolean;
};

const g = globalThis as GlobalRunner;

export async function runTick(): Promise<void> {
  if (g.__nichscopeRunnerBusy) return;
  g.__nichscopeRunnerBusy = true;
  try {
    const db = await getReadyDb();
    await ensureRecurringJobs(db);
    await processDueJobs(db, 2);
  } catch (error) {
    console.error("[jobs] embedded runner tick failed", error);
  } finally {
    g.__nichscopeRunnerBusy = false;
  }
}

export function startEmbeddedRunner(): void {
  if (!workerEmbedded) return;
  if (g.__nichscopeRunner) return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  console.log("[jobs] embedded runner started (WORKER_EMBEDDED=true)");
  // First tick shortly after boot, then every 30 seconds.
  setTimeout(() => void runTick(), 5_000).unref?.();
  g.__nichscopeRunner = setInterval(() => void runTick(), 30_000);
  g.__nichscopeRunner.unref?.();
}

export function stopEmbeddedRunner(): void {
  if (g.__nichscopeRunner) {
    clearInterval(g.__nichscopeRunner);
    g.__nichscopeRunner = undefined;
  }
}
