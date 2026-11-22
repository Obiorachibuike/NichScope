import { and, count, desc, eq, gte, sql } from "drizzle-orm";
import type { Database } from "@/lib/db/client";
import {
  aiReports,
  auditLogs,
  categories,
  dataSources,
  nicheRankings,
  nicheWatchlists,
  niches,
  savedSearches,
  youtubeChannels,
  youtubeVideos,
} from "@/lib/db/schema";
import { demoMode, env } from "@/lib/env";
import {
  listRankings,
  type RankingCategory,
  type RankingPeriod,
} from "./ranking";
import { getWatchlistWithNiches, searchChannels, searchVideos, videoSearchSchema } from "./research";
import { listAlerts } from "./watchlist";
import { getQuotaSummary } from "@/lib/services/youtube/quota";

export interface DashboardOptions {
  category?: RankingCategory;
  period?: RankingPeriod;
  limit?: number;
}

export async function getDashboardData(
  db: Database,
  userId: string,
  options: DashboardOptions = {},
) {
  const category = options.category ?? "opportunity";
  const period = options.period ?? "30d";
  const limit = options.limit ?? 10;

  const [
    rankings,
    emerging,
    nicheCount,
    categoryCount,
    watchedCount,
    reportCount,
    savedSearchesCount,
    saved,
    reports,
    alerts,
    recentViews,
    freshness,
    sources,
    quota,
  ] = await Promise.all([
    listRankings(db, { category, period, limit }),
    listRankings(db, { category: "emerging", period: "30d", limit: 4 }),
    db.select({ value: count() }).from(niches).where(eq(niches.isActive, true)),
    db.select({ value: count() }).from(categories).where(eq(categories.isActive, true)),
    db
      .select({ value: count() })
      .from(nicheWatchlists)
      .where(eq(nicheWatchlists.userId, userId)),
    db.select({ value: count() }).from(aiReports).where(eq(aiReports.userId, userId)),
    db
      .select({ value: count() })
      .from(savedSearches)
      .where(eq(savedSearches.userId, userId)),
    getWatchlistWithNiches(db, userId).then((rows) => rows.slice(0, 4)),
    db
      .select({
        id: aiReports.id,
        title: aiReports.title,
        type: aiReports.type,
        status: aiReports.status,
        provider: aiReports.provider,
        isFallback: aiReports.isFallback,
        createdAt: aiReports.createdAt,
        nicheName: niches.name,
        nicheSlug: niches.slug,
      })
      .from(aiReports)
      .leftJoin(niches, eq(aiReports.nicheId, niches.id))
      .where(eq(aiReports.userId, userId))
      .orderBy(desc(aiReports.createdAt))
      .limit(5),
    listAlerts(db, userId, 3).catch(() => []),
    db
      .select({
        nicheId: auditLogs.entityId,
        name: niches.name,
        slug: niches.slug,
        categoryName: categories.name,
        viewedAt: sql<Date>`max(${auditLogs.createdAt})`,
      })
      .from(auditLogs)
      .innerJoin(niches, sql`${niches.id}::text = ${auditLogs.entityId}`)
      .innerJoin(categories, eq(niches.categoryId, categories.id))
      .where(and(eq(auditLogs.actorId, userId), eq(auditLogs.action, "niche.viewed")))
      .groupBy(auditLogs.entityId, niches.name, niches.slug, categories.name)
      .orderBy(desc(sql`max(${auditLogs.createdAt})`))
      .limit(4),
    getFreshness(db),
    getSourceStatuses(db),
    getQuotaSummary(db),
  ]);

  return {
    rankings,
    emerging,
    stats: {
      niches: Number(nicheCount[0]?.value ?? 0),
      categories: Number(categoryCount[0]?.value ?? 0),
      watched: Number(watchedCount[0]?.value ?? 0),
      reports: Number(reportCount[0]?.value ?? 0),
      savedSearches: Number(savedSearchesCount[0]?.value ?? 0),
    },
    saved,
    reports,
    alerts,
    recentViews,
    freshness,
    sources,
    quota,
    demoData: demoMode,
    rankingCategory: category,
    rankingPeriod: period,
    rankingLimit: limit,
  };
}

export async function getFreshness(db: Database) {
  const [rankingFreshness] = await db
    .select({ latest: sql<Date | null>`max(${nicheRankings.computedAt})` })
    .from(nicheRankings)
    .where(demoMode ? sql`true` : eq(nicheRankings.isFixture, false));

  const [channelFreshness] = await db
    .select({ latest: sql<Date | null>`max(${youtubeChannels.fetchedAt})` })
    .from(youtubeChannels)
    .where(demoMode ? sql`true` : eq(youtubeChannels.isFixture, false));

  const [videoFreshness] = await db
    .select({ latest: sql<Date | null>`max(${youtubeVideos.fetchedAt})` })
    .from(youtubeVideos)
    .where(demoMode ? sql`true` : eq(youtubeVideos.isFixture, false));

  const [purge] = await db
    .select({ at: auditLogs.createdAt })
    .from(auditLogs)
    .where(eq(auditLogs.action, "data.retention.purge"))
    .orderBy(desc(auditLogs.createdAt))
    .limit(1);

  return {
    rankingsAt: rankingFreshness?.latest ?? null,
    channelsAt: channelFreshness?.latest ?? null,
    videosAt: videoFreshness?.latest ?? null,
    lastRetentionPurgeAt: purge?.at ?? null,
    retentionDays: Math.min(env.YOUTUBE_DATA_RETENTION_DAYS, 30),
  };
}

export async function getSourceStatuses(db: Database) {
  const rows = await db
    .select({
      key: dataSources.key,
      name: dataSources.name,
      type: dataSources.type,
      status: dataSources.status,
      permitsCrossChannelAggregation: dataSources.permitsCrossChannelAggregation,
      permitsHistoricalTracking: dataSources.permitsHistoricalTracking,
      retentionDays: dataSources.retentionDays,
      lastVerifiedAt: dataSources.lastVerifiedAt,
    })
    .from(dataSources)
    .orderBy(dataSources.name);

  return rows
    .filter((row) => {
      if (row.key === "demo_fixture" && !demoMode) return false;
      if (row.key === "licensed_analytics" && row.status === "pending_approval")
        return true;
      return true;
    })
    .map((row) => ({
      ...row,
      operational:
        row.status === "active" &&
        (row.key !== "demo_fixture" || demoMode),
    }));
}

/** Cross-entity search used by the dashboard search bar and /search. */
export async function globalSearch(db: Database, query: string) {
  const q = query.trim();
  if (q.length < 2) {
    return { niches: [], categories: [], channels: [], videos: [], query: q };
  }
  const term = `%${q.replace(/[%_]/g, (m) => `\\${m}`)}%`;

  const [nicheRows, categoryRows, channelResult, videoResult] = await Promise.all([
    db
      .select({
        slug: niches.slug,
        name: niches.name,
        description: niches.description,
        categoryName: categories.name,
        opportunityScore: niches.opportunityScore,
      })
      .from(niches)
      .innerJoin(categories, eq(niches.categoryId, categories.id))
      .where(
        and(
          eq(niches.isActive, true),
          sql`(${niches.name} ilike ${term} or ${niches.slug} ilike ${term} or ${niches.aliases}::text ilike ${term} or ${niches.keywords}::text ilike ${term})`,
        ),
      )
      .orderBy(desc(niches.opportunityScore))
      .limit(6),
    db
      .select({ slug: categories.slug, name: categories.name })
      .from(categories)
      .where(sql`${categories.name} ilike ${term}`)
      .limit(3),
    searchChannels(db, { q, sort: "subscribers", page: 1, pageSize: 3 }),
    searchVideos(db, videoSearchSchema.parse({ q, sort: "views", page: 1, pageSize: 3 })),
  ]);

  return {
    query: q,
    niches: nicheRows.map((row) => ({
      ...row,
      opportunityScore:
        row.opportunityScore === null ? null : Number(row.opportunityScore),
    })),
    categories: categoryRows,
    channels: channelResult.items,
    videos: videoResult.items,
  };
}

/**
 * Records a taxonomy search for the authenticated user. Backed by the audit
 * log so no extra table is required; identical queries within an hour are
 * de-duplicated.
 */
export async function recordSearch(
  db: Database,
  userId: string,
  query: string,
): Promise<void> {
  const q = query.trim();
  if (q.length < 2) return;
  const since = new Date(Date.now() - 3_600_000);
  try {
    const existing = await db
      .select({ id: auditLogs.id })
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.actorId, userId),
          eq(auditLogs.action, "search.performed"),
          gte(auditLogs.createdAt, since),
          sql`${auditLogs.metadata}->>'q' = ${q}`,
        ),
      )
      .limit(1);
    if (existing[0]) return;
    await db.insert(auditLogs).values({
      actorId: userId,
      action: "search.performed",
      entityType: "search",
      metadata: { q },
    });
  } catch (error) {
    console.error("[dashboard] failed to record search", error);
  }
}

/** Most recent distinct searches for the command palette and search page. */
export async function getSearchHistory(
  db: Database,
  userId: string,
  limit = 6,
): Promise<string[]> {
  const rows = await db
    .select({
      query: sql<string>`${auditLogs.metadata}->>'q'`,
      latest: sql<Date>`max(${auditLogs.createdAt})`,
    })
    .from(auditLogs)
    .where(
      and(
        eq(auditLogs.actorId, userId),
        eq(auditLogs.action, "search.performed"),
        sql`${auditLogs.metadata}->>'q' is not null`,
      ),
    )
    .groupBy(sql`${auditLogs.metadata}->>'q'`)
    .orderBy(desc(sql`max(${auditLogs.createdAt})`))
    .limit(limit);
  return rows.map((row) => row.query).filter(Boolean);
}

/** Writes a lightweight "recently explored" record (audit-backed). */
export async function recordNicheView(
  db: Database,
  userId: string,
  nicheId: string,
): Promise<void> {
  await db
    .insert(auditLogs)
    .values({
      actorId: userId,
      action: "niche.viewed",
      entityType: "niche",
      entityId: nicheId,
      metadata: {},
    })
    .catch((error) => console.error("[dashboard] failed to record niche view", error));
}
