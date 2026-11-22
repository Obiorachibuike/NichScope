import { and, eq, gte, sql } from "drizzle-orm";
import type { Database } from "@/lib/db/client";
import { apiUsage } from "@/lib/db/schema";
import { env } from "@/lib/env";

/**
 * YouTube Data API quota accounting.
 *
 * search.list is the expensive call (100 units); everything else is 1 unit.
 * Requests are refused server-side before they are made when the daily budget
 * would be exceeded, which keeps a runaway UI from exhausting the quota.
 */
export const YOUTUBE_QUOTA_COSTS = {
  "search.list": 100,
  "videos.list": 1,
  "channels.list": 1,
  "playlistItems.list": 1,
  "videoCategories.list": 1,
  "i18nRegions.list": 1,
} as const;

export type YouTubeEndpoint = keyof typeof YOUTUBE_QUOTA_COSTS;

export function quotaCost(endpoint: YouTubeEndpoint): number {
  return YOUTUBE_QUOTA_COSTS[endpoint];
}

export function quotaDate(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export interface QuotaSummary {
  provider: "youtube";
  configured: boolean;
  date: string;
  limit: number;
  used: number;
  remaining: number;
  percentUsed: number;
  byEndpoint: { endpoint: string; units: number; calls: number }[];
  cacheHits: number;
}

export async function getQuotaSummary(
  db: Database,
  now = new Date(),
): Promise<QuotaSummary> {
  const date = quotaDate(now);
  const rows = await db
    .select({
      endpoint: apiUsage.endpoint,
      units: sql<number>`coalesce(sum(${apiUsage.units}),0)::int`,
      calls: sql<number>`count(*)::int`,
      cacheHits: sql<number>`coalesce(sum(case when ${apiUsage.cacheHit} then 1 else 0 end),0)::int`,
    })
    .from(apiUsage)
    .where(and(eq(apiUsage.provider, "youtube"), eq(apiUsage.quotaDate, date)))
    .groupBy(apiUsage.endpoint);

  const used = rows.reduce((sum, row) => sum + Number(row.units), 0);
  const limit = env.YOUTUBE_DAILY_QUOTA;
  return {
    provider: "youtube",
    configured: Boolean(env.YOUTUBE_API_KEY),
    date,
    limit,
    used,
    remaining: Math.max(0, limit - used),
    percentUsed: limit > 0 ? Math.round((used / limit) * 1000) / 10 : 0,
    byEndpoint: rows.map((row) => ({
      endpoint: row.endpoint,
      units: Number(row.units),
      calls: Number(row.calls),
    })),
    cacheHits: rows.reduce((sum, row) => sum + Number(row.cacheHits), 0),
  };
}

export class QuotaExceededError extends Error {
  constructor(
    message: string,
    public readonly used: number,
    public readonly limit: number,
  ) {
    super(message);
    this.name = "QuotaExceededError";
  }
}

export async function assertQuotaAvailable(
  db: Database,
  endpoint: YouTubeEndpoint,
  units?: number,
): Promise<void> {
  const cost = units ?? quotaCost(endpoint);
  const summary = await getQuotaSummary(db);
  if (summary.used + cost > summary.limit) {
    throw new QuotaExceededError(
      `Daily YouTube API quota exhausted (${summary.used}/${summary.limit} units). Try again after the quota resets at midnight Pacific Time.`,
      summary.used,
      summary.limit,
    );
  }
}

export async function recordApiUsage(
  db: Database,
  input: {
    sourceId?: string | null;
    provider: string;
    endpoint: string;
    units: number;
    statusCode?: number | null;
    latencyMs?: number | null;
    cacheHit?: boolean;
    requestId?: string | null;
    userId?: string | null;
    metadata?: Record<string, unknown>;
    now?: Date;
  },
): Promise<void> {
  const now = input.now ?? new Date();
  try {
    await db.insert(apiUsage).values({
      sourceId: input.sourceId ?? null,
      provider: input.provider,
      endpoint: input.endpoint,
      units: input.units,
      quotaDate: quotaDate(now),
      statusCode: input.statusCode ?? null,
      latencyMs: input.latencyMs ?? null,
      cacheHit: input.cacheHit ?? false,
      requestId: input.requestId ?? null,
      userId: input.userId ?? null,
      metadata: input.metadata ?? {},
      createdAt: now,
    });
  } catch (error) {
    console.error("[quota] failed to record API usage", error);
  }
}

export async function getRecentUsage(db: Database, hours = 24) {
  return db
    .select({
      endpoint: apiUsage.endpoint,
      units: apiUsage.units,
      statusCode: apiUsage.statusCode,
      latencyMs: apiUsage.latencyMs,
      cacheHit: apiUsage.cacheHit,
      createdAt: apiUsage.createdAt,
    })
    .from(apiUsage)
    .where(
      and(
        eq(apiUsage.provider, "youtube"),
        gte(apiUsage.createdAt, new Date(Date.now() - hours * 3_600_000)),
      ),
    )
    .orderBy(sql`${apiUsage.createdAt} desc`)
    .limit(50);
}
