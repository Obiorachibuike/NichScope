import { and, desc, eq, gte, sql } from "drizzle-orm";
import type { Database } from "@/lib/db/client";
import {
  aiReports,
  apiSnapshots,
  auditLogs,
  backgroundJobs,
  nicheMetrics,
  nicheWatchlists,
  niches,
  users,
  watchlistAlerts,
} from "@/lib/db/schema";
import { demoMode, env, licensedProviderConfigured, youtubeConfigured } from "@/lib/env";
import { purgeExpiredYouTubeData } from "@/lib/services/compliance";
import { generateRankings, listRankings, RANKING_PERIODS } from "@/lib/services/ranking";
import { getQuotaSummary } from "@/lib/services/youtube/quota";
import {
  refreshStaleChannels,
  refreshStaleVideos,
  syncChannelSearch,
  syncVideoSearch,
} from "@/lib/services/youtube/sync";
import { generateReport } from "@/lib/services/ai";
import { auditLog } from "@/lib/services/audit";
import { JOB_NAMES, type JobName, type JobPayload } from "./types";

export type JobResult = Record<string, unknown>;

type Handler = (db: Database, payload: JobPayload) => Promise<JobResult>;

const youtubeDiscovery: Handler = async (db, payload) => {
  if (!youtubeConfigured) {
    return { skipped: true, reason: "YOUTUBE_API_KEY is not configured" };
  }
  const query = typeof payload.query === "string" ? payload.query : null;
  if (!query) {
    return { skipped: true, reason: "A query payload is required for discovery" };
  }
  const type = payload.type === "channel" ? "channel" : "video";
  const nicheId = typeof payload.nicheId === "string" ? payload.nicheId : null;
  const result =
    type === "channel"
      ? await syncChannelSearch(db, { query, nicheId })
      : await syncVideoSearch(db, { query, nicheId });
  return { query, type, ...result };
};

const videoMetadata: Handler = async (db) => {
  const result = await refreshStaleVideos(db, 20);
  return result as JobResult;
};

const channelMetadata: Handler = async (db) => {
  const result = await refreshStaleChannels(db, 20);
  return result as JobResult;
};

const dataRetention: Handler = async (db) => {
  const result = await purgeExpiredYouTubeData(db);
  return result as unknown as JobResult;
};

const dataRefresh: Handler = async (db) => {
  const videos = await refreshStaleVideos(db, 10);
  const channels = await refreshStaleChannels(db, 10);
  const purged = await purgeExpiredYouTubeData(db);
  return { videos, channels, purged };
};

const licensedIngest: Handler = async () => {
  if (!licensedProviderConfigured) {
    return {
      skipped: true,
      reason:
        "No licensed analytics provider is enabled (LICENSED_DATA_PROVIDER_ENABLED=false). No data was ingested.",
    };
  }
  // A provider-specific adapter must be implemented against the signed
  // contract. Until then, we explicitly ingest nothing rather than invent data.
  return {
    skipped: true,
    reason:
      "Licensed provider enabled, but no ingestion adapter is configured for this deployment. Configure the provider adapter before scheduling this job.",
  };
};

const rankingsGenerate: Handler = async (db) => {
  const results: Record<string, unknown> = {};
  for (const period of RANKING_PERIODS) {
    results[period] = await generateRankings(db, { period });
  }
  const generated = Object.values(results).reduce<number>(
    (sum, value) => sum + Number((value as { generated?: number }).generated ?? 0),
    0,
  );
  return { generated, periods: results };
};

const aiReportGenerate: Handler = async (db, payload) => {
  const userId = typeof payload.userId === "string" ? payload.userId : null;
  const nicheSlug = typeof payload.nicheSlug === "string" ? payload.nicheSlug : null;
  if (!userId || !nicheSlug) {
    return { skipped: true, reason: "userId and nicheSlug are required" };
  }
  const [user] = await db
    .select({ plan: users.plan })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) return { skipped: true, reason: "User not found" };

  const type =
    typeof payload.type === "string" &&
    [
      "niche_analysis",
      "subniches",
      "video_ideas",
      "competition",
      "channel_strategy",
      "research_report",
    ].includes(payload.type)
      ? (payload.type as
          | "niche_analysis"
          | "subniches"
          | "video_ideas"
          | "competition"
          | "channel_strategy"
          | "research_report")
      : "niche_analysis";

  const result = await generateReport(db, {
    userId,
    plan: user.plan,
    nicheSlug,
    type,
  });
  return { reportId: result.reportId, provider: result.provider };
};

const watchlistMonitor: Handler = async (db) => {
  const top = await listRankings(db, {
    category: "opportunity",
    period: "30d",
    limit: 10,
  });
  const rankByNiche = new Map(top.map((item) => [item.nicheId, item]));

  const watched = await db
    .select({
      watchlistId: nicheWatchlists.id,
      nicheId: niches.id,
      name: niches.name,
      isFixture: sql<boolean>`coalesce(${niches.metadata}->>'fixtureMetrics', 'false') = 'true'`,
    })
    .from(nicheWatchlists)
    .innerJoin(niches, eq(nicheWatchlists.nicheId, niches.id));

  let alertsCreated = 0;
  const since = new Date(Date.now() - 7 * 86_400_000);

  for (const item of watched) {
    const ranking = rankByNiche.get(item.nicheId);
    if (!ranking) continue;

    const existing = await db
      .select({ id: watchlistAlerts.id })
      .from(watchlistAlerts)
      .where(
        and(
          eq(watchlistAlerts.watchlistId, item.watchlistId),
          eq(watchlistAlerts.type, "rank_change"),
          gte(watchlistAlerts.createdAt, since),
          sql`${watchlistAlerts.payload}->>'rank' = ${String(ranking.rank)}`,
        ),
      )
      .limit(1);
    if (existing[0]) continue;

    const fixtureNote = ranking.isFixture ? " (demo data)" : "";
    await db.insert(watchlistAlerts).values({
      watchlistId: item.watchlistId,
      type: "rank_change",
      message: `${item.name} is ranked #${ranking.rank} in the latest 30-day opportunity ranking${fixtureNote}.`,
      payload: {
        rank: ranking.rank,
        score: ranking.score,
        source: ranking.sourceKey,
        isFixture: ranking.isFixture,
      },
    });
    alertsCreated += 1;
  }

  // Metric movement alerts from the two most recent 30-day estimates.
  const nichesWithMetrics = await db
    .select({ nicheId: nicheMetrics.nicheId })
    .from(nicheMetrics)
    .where(eq(nicheMetrics.period, "30d"))
    .groupBy(nicheMetrics.nicheId);

  let metricAlerts = 0;
  for (const row of nichesWithMetrics) {
    const lastTwo = await db
      .select({
        opportunityScore: nicheMetrics.opportunityScore,
        periodEnd: nicheMetrics.periodEnd,
      })
      .from(nicheMetrics)
      .where(
        and(
          eq(nicheMetrics.nicheId, row.nicheId),
          eq(nicheMetrics.period, "30d"),
        ),
      )
      .orderBy(desc(nicheMetrics.periodEnd))
      .limit(2);
    if (lastTwo.length < 2) continue;
    const latest = Number(lastTwo[0]!.opportunityScore ?? 0);
    const previous = Number(lastTwo[1]!.opportunityScore ?? 0);
    if (Math.abs(latest - previous) < 5) continue;

    const watchRows = watched.filter((w) => w.nicheId === row.nicheId);
    for (const watch of watchRows) {
      const exists = await db
        .select({ id: watchlistAlerts.id })
        .from(watchlistAlerts)
        .where(
          and(
            eq(watchlistAlerts.watchlistId, watch.watchlistId),
            eq(watchlistAlerts.type, "metric_change"),
            gte(watchlistAlerts.createdAt, since),
          ),
        )
        .limit(1);
      if (exists[0]) continue;
      await db.insert(watchlistAlerts).values({
        watchlistId: watch.watchlistId,
        type: "metric_change",
        message: `${watch.name} opportunity score moved ${latest > previous ? "up" : "down"} by ${Math.abs(latest - previous).toFixed(1)} points in the latest estimate.`,
        payload: { previous, latest, isEstimate: true },
      });
      metricAlerts += 1;
    }
  }

  return { watched: watched.length, rankAlerts: alertsCreated, metricAlerts };
};

const quotaMonitor: Handler = async (db) => {
  const summary = await getQuotaSummary(db);
  const warnings: string[] = [];
  if (!summary.configured) {
    warnings.push("YouTube API key is not configured; no quota is being consumed.");
  }
  if (summary.percentUsed >= 80) {
    warnings.push(
      `YouTube quota usage is at ${summary.percentUsed}% (${summary.used}/${summary.limit} units).`,
    );
  }

  if (warnings.length > 0) {
    const since = new Date(Date.now() - 86_400_000);
    const existing = await db
      .select({ id: auditLogs.id })
      .from(auditLogs)
      .where(
        and(eq(auditLogs.action, "quota.warning"), gte(auditLogs.createdAt, since)),
      )
      .limit(1);
    if (!existing[0]) {
      await auditLog(db, {
        action: "quota.warning",
        entityType: "youtube_quota",
        metadata: { ...summary, warnings },
      });
    }
  }

  return {
    used: summary.used,
    limit: summary.limit,
    percentUsed: summary.percentUsed,
    configured: summary.configured,
    warnings,
  };
};

const snapshotsCleanup: Handler = async (db) => {
  const deleted = await db
    .delete(apiSnapshots)
    .where(sql`${apiSnapshots.expiresAt} < now()`)
    .returning({ id: apiSnapshots.id });
  return { deleted: deleted.length };
};

const heartbeat: Handler = async (db) => {
  const payload = {
    pid: process.pid,
    uptimeSeconds: Math.round(process.uptime()),
    workerConcurrency: env.WORKER_CONCURRENCY,
    demoMode,
  };
  await db.insert(backgroundJobs).values({
    name: "worker.heartbeat",
    queue: "ops",
    status: "completed",
    payload,
    result: { ok: true },
    attempts: 1,
    startedAt: new Date(),
    completedAt: new Date(),
  });
  return payload;
};

export const JOB_HANDLERS: Record<JobName, Handler> = {
  "youtube.discovery": youtubeDiscovery,
  "youtube.video-metadata": videoMetadata,
  "youtube.channel-metadata": channelMetadata,
  "data.retention": dataRetention,
  "data.refresh": dataRefresh,
  "licensed.ingest": licensedIngest,
  "rankings.generate": rankingsGenerate,
  "ai.report.generate": aiReportGenerate,
  "watchlist.monitor": watchlistMonitor,
  "quota.monitor": quotaMonitor,
  "snapshots.cleanup": snapshotsCleanup,
  "worker.heartbeat": heartbeat,
};

export function isJobName(value: string): value is JobName {
  return (JOB_NAMES as readonly string[]).includes(value);
}

/** Whether AI reports can be generated asynchronously (used by admin UI). */
export async function aiJobAvailable(db: Database): Promise<boolean> {
  const [row] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(aiReports);
  return Boolean(row);
}
