import { desc, eq, sql } from "drizzle-orm";
import type { Database } from "@/lib/db/client";
import { backgroundJobs } from "@/lib/db/schema";
import { JOB_HANDLERS, isJobName } from "./handlers";
import type { JobName, JobPayload } from "./types";

/**
 * Durable job ledger.
 *
 * Jobs are claimed with `SELECT … FOR UPDATE SKIP LOCKED`, which keeps the
 * worker safe under concurrency. Failures retry with exponential backoff and
 * eventually land in a dead-letter state. Idempotency keys prevent duplicate
 * enqueues (e.g. a scheduled job firing twice).
 */

export interface EnqueueOptions {
  idempotencyKey?: string;
  scheduledFor?: Date;
  maxAttempts?: number;
  queue?: string;
}

export async function enqueueJob(
  db: Database,
  name: JobName,
  payload: JobPayload = {},
  options: EnqueueOptions = {},
) {
  if (options.idempotencyKey) {
    const existing = await db
      .select()
      .from(backgroundJobs)
      .where(eq(backgroundJobs.idempotencyKey, options.idempotencyKey))
      .limit(1);
    if (existing[0]) return { job: existing[0], deduplicated: true };
  }

  const inserted = await db
    .insert(backgroundJobs)
    .values({
      name,
      queue: options.queue ?? "default",
      status: "queued",
      payload,
      maxAttempts: options.maxAttempts ?? 3,
      scheduledFor: options.scheduledFor ?? null,
      idempotencyKey: options.idempotencyKey ?? null,
    })
    .onConflictDoNothing()
    .returning();

  if (!inserted[0] && options.idempotencyKey) {
    const existing = await db
      .select()
      .from(backgroundJobs)
      .where(eq(backgroundJobs.idempotencyKey, options.idempotencyKey))
      .limit(1);
    return { job: existing[0]!, deduplicated: true };
  }

  return { job: inserted[0]!, deduplicated: false };
}

interface RawRow {
  id: string;
  name: string;
  payload: unknown;
  attempts: number;
  max_attempts: number;
}

export interface ClaimedJob {
  id: string;
  name: string;
  payload: JobPayload;
  attempts: number;
  maxAttempts: number;
}

function extractRows(result: unknown): RawRow[] {
  if (!result) return [];
  if (Array.isArray(result)) return result as RawRow[];
  const maybe = result as { rows?: RawRow[] };
  return maybe.rows ?? [];
}

export async function claimJobs(db: Database, limit = 3): Promise<ClaimedJob[]> {
  const result = await db.execute(sql`
    update background_jobs
    set status = 'running', started_at = now(), attempts = attempts + 1
    where id in (
      select id from background_jobs
      where status = 'queued'
        and (scheduled_for is null or scheduled_for <= now())
      order by created_at asc
      limit ${limit}
      for update skip locked
    )
    returning id, name, payload, attempts, max_attempts
  `);

  return extractRows(result).map((row) => ({
    id: row.id,
    name: row.name,
    payload: (row.payload as JobPayload) ?? {},
    attempts: Number(row.attempts),
    maxAttempts: Number(row.max_attempts),
  }));
}

export async function runClaimedJob(db: Database, job: ClaimedJob): Promise<void> {
  const started = Date.now();
  if (!isJobName(job.name)) {
    await db
      .update(backgroundJobs)
      .set({
        status: "dead_letter",
        error: `Unknown job name: ${job.name}`,
        completedAt: new Date(),
      })
      .where(eq(backgroundJobs.id, job.id));
    return;
  }

  try {
    const result = await JOB_HANDLERS[job.name](db, job.payload);
    await db
      .update(backgroundJobs)
      .set({
        status: "completed",
        result,
        error: null,
        durationMs: Date.now() - started,
        completedAt: new Date(),
      })
      .where(eq(backgroundJobs.id, job.id));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const canRetry = job.attempts < job.maxAttempts;
    const backoffSeconds = Math.min(300, 5 * 2 ** job.attempts);
    console.error(`[jobs] ${job.name} failed (attempt ${job.attempts})`, error);
    await db
      .update(backgroundJobs)
      .set({
        status: canRetry ? "queued" : "dead_letter",
        error: message.slice(0, 2000),
        durationMs: Date.now() - started,
        scheduledFor: canRetry
          ? new Date(Date.now() + backoffSeconds * 1000)
          : null,
        completedAt: canRetry ? null : new Date(),
      })
      .where(eq(backgroundJobs.id, job.id));
  }
}

export async function processDueJobs(db: Database, limit = 3): Promise<number> {
  const jobs = await claimJobs(db, limit);
  for (const job of jobs) {
    await runClaimedJob(db, job);
  }
  return jobs.length;
}

const RECURRING: {
  name: JobName;
  everyMs: number;
  key: (now: Date) => string;
  queue?: string;
}[] = [
  {
    name: "worker.heartbeat",
    everyMs: 5 * 60_000,
    key: (now) => `heartbeat:${now.toISOString().slice(0, 16)}`,
    queue: "ops",
  },
  {
    name: "rankings.generate",
    everyMs: 6 * 3_600_000,
    key: (now) => `rankings:${now.toISOString().slice(0, 13)}`,
  },
  {
    name: "data.retention",
    everyMs: 24 * 3_600_000,
    key: (now) => `retention:${now.toISOString().slice(0, 10)}`,
  },
  {
    name: "data.refresh",
    everyMs: 6 * 3_600_000,
    key: (now) => `refresh:${now.toISOString().slice(0, 13)}`,
  },
  {
    name: "watchlist.monitor",
    everyMs: 3 * 3_600_000,
    key: (now) => `watchlist:${now.toISOString().slice(0, 13)}`,
  },
  {
    name: "quota.monitor",
    everyMs: 3_600_000,
    key: (now) => `quota:${now.toISOString().slice(0, 13)}`,
    queue: "ops",
  },
  {
    name: "snapshots.cleanup",
    everyMs: 24 * 3_600_000,
    key: (now) => `snapshots:${now.toISOString().slice(0, 10)}`,
    queue: "ops",
  },
];

/** Enqueues recurring maintenance jobs that have not run in their window. */
export async function ensureRecurringJobs(db: Database): Promise<number> {
  const now = new Date();
  let queued = 0;
  for (const job of RECURRING) {
    const result = await enqueueJob(db, job.name, {}, {
      idempotencyKey: job.key(now),
      queue: job.queue,
    });
    if (!result.deduplicated) queued += 1;
  }
  return queued;
}

export async function getJobStats(db: Database) {
  const [row] = await db
    .select({
      queued: sql<number>`coalesce(sum(case when ${backgroundJobs.status} = 'queued' then 1 else 0 end),0)::int`,
      running: sql<number>`coalesce(sum(case when ${backgroundJobs.status} = 'running' then 1 else 0 end),0)::int`,
      completed: sql<number>`coalesce(sum(case when ${backgroundJobs.status} = 'completed' then 1 else 0 end),0)::int`,
      failed: sql<number>`coalesce(sum(case when ${backgroundJobs.status} = 'failed' then 1 else 0 end),0)::int`,
      deadLetter: sql<number>`coalesce(sum(case when ${backgroundJobs.status} = 'dead_letter' then 1 else 0 end),0)::int`,
    })
    .from(backgroundJobs);
  return row ?? { queued: 0, running: 0, completed: 0, failed: 0, deadLetter: 0 };
}

export async function listRecentJobs(db: Database, limit = 20) {
  return db
    .select()
    .from(backgroundJobs)
    .orderBy(desc(backgroundJobs.createdAt))
    .limit(limit);
}
