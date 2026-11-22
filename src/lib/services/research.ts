import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { z } from "zod";
import type { Database } from "@/lib/db/client";
import {
  categories,
  dataSources,
  nicheWatchlists,
  niches,
  youtubeChannels,
  youtubeVideos,
} from "@/lib/db/schema";
import { demoMode } from "@/lib/env";

/**
 * Channel and video research over *stored* public metadata. Rows carry their
 * source, fetch time and fixture status. Fixture rows are hidden whenever demo
 * mode is off. No cross-channel derived statistics are produced here — only the
 * individual records the source returned.
 */

function fixtureCondition(column: typeof youtubeChannels.isFixture | typeof youtubeVideos.isFixture) {
  return demoMode ? undefined : eq(column, false);
}

export const channelSearchSchema = z.object({
  q: z.string().trim().max(120).optional(),
  country: z.string().trim().max(2).optional(),
  sort: z.enum(["subscribers", "views", "videos", "name", "recent"]).catch("subscribers"),
  page: z.coerce.number().int().min(1).max(500).catch(1),
  pageSize: z.coerce.number().int().min(6).max(48).catch(12),
});

export type ChannelSearchFilters = z.infer<typeof channelSearchSchema>;

export interface ChannelListItem {
  channelId: string;
  title: string;
  description: string | null;
  thumbnailUrl: string | null;
  country: string | null;
  publishedAt: Date | null;
  subscriberCount: number | null;
  viewCount: number | null;
  videoCount: number | null;
  nicheName: string | null;
  nicheSlug: string | null;
  sourceKey: string;
  sourceName: string;
  fetchedAt: Date;
  refreshDueAt: Date | null;
  isFixture: boolean;
}

export interface ChannelSearchResult {
  items: ChannelListItem[];
  total: number;
  page: number;
  pageCount: number;
  pageSize: number;
}

export async function searchChannels(
  db: Database,
  filters: ChannelSearchFilters,
): Promise<ChannelSearchResult> {
  const conditions: (SQL | undefined)[] = [fixtureCondition(youtubeChannels.isFixture)];
  if (filters.q) {
    const term = `%${filters.q.replace(/[%_]/g, (m) => `\\${m}`)}%`;
    conditions.push(
      or(
        ilike(youtubeChannels.title, term),
        ilike(youtubeChannels.description, term),
        eq(youtubeChannels.channelId, filters.q),
      ),
    );
  }
  if (filters.country) {
    conditions.push(eq(youtubeChannels.country, filters.country.toUpperCase()));
  }
  const where = and(...conditions.filter(Boolean));

  const orderBy = (() => {
    switch (filters.sort) {
      case "views":
        return sql`${youtubeChannels.viewCount} desc nulls last`;
      case "videos":
        return sql`${youtubeChannels.videoCount} desc nulls last`;
      case "name":
        return asc(youtubeChannels.title);
      case "recent":
        return desc(youtubeChannels.publishedAt);
      default:
        return sql`${youtubeChannels.subscriberCount} desc nulls last`;
    }
  })();

  const [rows, totalRow] = await Promise.all([
    db
      .select({
        channelId: youtubeChannels.channelId,
        title: youtubeChannels.title,
        description: youtubeChannels.description,
        thumbnailUrl: youtubeChannels.thumbnailUrl,
        country: youtubeChannels.country,
        publishedAt: youtubeChannels.publishedAt,
        subscriberCount: youtubeChannels.subscriberCount,
        viewCount: youtubeChannels.viewCount,
        videoCount: youtubeChannels.videoCount,
        nicheName: niches.name,
        nicheSlug: niches.slug,
        sourceKey: dataSources.key,
        sourceName: dataSources.name,
        fetchedAt: youtubeChannels.fetchedAt,
        refreshDueAt: youtubeChannels.refreshDueAt,
        isFixture: youtubeChannels.isFixture,
      })
      .from(youtubeChannels)
      .innerJoin(dataSources, eq(youtubeChannels.sourceId, dataSources.id))
      .leftJoin(niches, eq(youtubeChannels.nicheId, niches.id))
      .where(where)
      .orderBy(orderBy)
      .limit(filters.pageSize)
      .offset((filters.page - 1) * filters.pageSize),
    db.select({ value: count() }).from(youtubeChannels).where(where),
  ]);

  const total = Number(totalRow[0]?.value ?? 0);
  return {
    items: rows,
    total,
    page: filters.page,
    pageSize: filters.pageSize,
    pageCount: Math.max(1, Math.ceil(total / filters.pageSize)),
  };
}

export async function getChannelDetail(db: Database, channelId: string) {
  const rows = await db
    .select({
      channel: youtubeChannels,
      nicheName: niches.name,
      nicheSlug: niches.slug,
      sourceKey: dataSources.key,
      sourceName: dataSources.name,
    })
    .from(youtubeChannels)
    .innerJoin(dataSources, eq(youtubeChannels.sourceId, dataSources.id))
    .leftJoin(niches, eq(youtubeChannels.nicheId, niches.id))
    .where(
      and(
        eq(youtubeChannels.channelId, channelId),
        fixtureCondition(youtubeChannels.isFixture),
      ),
    )
    .limit(1);
  if (!rows[0]) return null;

  const videos = await db
    .select()
    .from(youtubeVideos)
    .where(
      and(
        eq(youtubeVideos.channelId, channelId),
        fixtureCondition(youtubeVideos.isFixture),
      ),
    )
    .orderBy(desc(youtubeVideos.publishedAt))
    .limit(12);

  return { ...rows[0], videos };
}

export const videoSearchSchema = z.object({
  q: z.string().trim().max(120).optional(),
  format: z.enum(["all", "shorts", "long_form"]).catch("all"),
  category: z.string().trim().max(80).optional(),
  nicheId: z.string().uuid().optional(),
  language: z.string().trim().max(12).optional(),
  region: z.string().trim().max(2).optional(),
  publishedWithin: z.enum(["any", "7", "30", "90", "365"]).catch("any"),
  sort: z.enum(["views", "recent", "engagement", "title"]).catch("recent"),
  page: z.coerce.number().int().min(1).max(500).catch(1),
  pageSize: z.coerce.number().int().min(6).max(48).catch(12),
});

export type VideoSearchFilters = z.infer<typeof videoSearchSchema>;

export interface VideoListItem {
  videoId: string;
  title: string;
  channelId: string | null;
  channelTitle: string | null;
  thumbnailUrl: string | null;
  publishedAt: Date | null;
  durationSeconds: number | null;
  viewCount: number | null;
  likeCount: number | null;
  commentCount: number | null;
  categoryName: string | null;
  format: string;
  defaultLanguage: string | null;
  regionCode: string | null;
  nicheName: string | null;
  nicheSlug: string | null;
  sourceKey: string;
  sourceName: string;
  fetchedAt: Date;
  isFixture: boolean;
}

export async function searchVideos(
  db: Database,
  filters: VideoSearchFilters,
): Promise<{
  items: VideoListItem[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}> {
  const conditions: (SQL | undefined)[] = [fixtureCondition(youtubeVideos.isFixture)];
  if (filters.q) {
    const term = `%${filters.q.replace(/[%_]/g, (m) => `\\${m}`)}%`;
    conditions.push(
      or(
        ilike(youtubeVideos.title, term),
        ilike(youtubeVideos.description, term),
        ilike(youtubeVideos.channelTitle, term),
      ),
    );
  }
  if (filters.format !== "all") {
    conditions.push(eq(youtubeVideos.format, filters.format));
  }
  if (filters.language) {
    conditions.push(eq(youtubeVideos.defaultLanguage, filters.language));
  }
  if (filters.region) {
    conditions.push(eq(youtubeVideos.regionCode, filters.region.toUpperCase()));
  }
  if (filters.category) {
    conditions.push(eq(categories.slug, filters.category));
  }
  if (filters.nicheId) {
    conditions.push(eq(youtubeVideos.nicheId, filters.nicheId));
  }
  if (filters.publishedWithin !== "any") {
    const days = Number(filters.publishedWithin);
    conditions.push(
      gte(youtubeVideos.publishedAt, new Date(Date.now() - days * 86_400_000)),
    );
  }
  const where = and(...conditions.filter(Boolean));

  const orderBy = (() => {
    switch (filters.sort) {
      case "views":
        return sql`${youtubeVideos.viewCount} desc nulls last`;
      case "engagement":
        return sql`(coalesce(${youtubeVideos.likeCount},0) + coalesce(${youtubeVideos.commentCount},0) * 2) desc nulls last`;
      case "title":
        return asc(youtubeVideos.title);
      default:
        return desc(youtubeVideos.publishedAt);
    }
  })();

  const [rows, totalRow] = await Promise.all([
    db
      .select({
        videoId: youtubeVideos.videoId,
        title: youtubeVideos.title,
        channelId: youtubeVideos.channelId,
        channelTitle: youtubeVideos.channelTitle,
        thumbnailUrl: youtubeVideos.thumbnailUrl,
        publishedAt: youtubeVideos.publishedAt,
        durationSeconds: youtubeVideos.durationSeconds,
        viewCount: youtubeVideos.viewCount,
        likeCount: youtubeVideos.likeCount,
        commentCount: youtubeVideos.commentCount,
        categoryName: youtubeVideos.categoryName,
        format: youtubeVideos.format,
        defaultLanguage: youtubeVideos.defaultLanguage,
        regionCode: youtubeVideos.regionCode,
        nicheName: niches.name,
        nicheSlug: niches.slug,
        sourceKey: dataSources.key,
        sourceName: dataSources.name,
        fetchedAt: youtubeVideos.fetchedAt,
        isFixture: youtubeVideos.isFixture,
      })
      .from(youtubeVideos)
      .innerJoin(dataSources, eq(youtubeVideos.sourceId, dataSources.id))
      .leftJoin(niches, eq(youtubeVideos.nicheId, niches.id))
      .leftJoin(categories, eq(niches.categoryId, categories.id))
      .where(where)
      .orderBy(orderBy)
      .limit(filters.pageSize)
      .offset((filters.page - 1) * filters.pageSize),
    db
      .select({ value: count() })
      .from(youtubeVideos)
      .leftJoin(niches, eq(youtubeVideos.nicheId, niches.id))
      .leftJoin(categories, eq(niches.categoryId, categories.id))
      .where(where),
  ]);

  const total = Number(totalRow[0]?.value ?? 0);
  return {
    items: rows,
    total,
    page: filters.page,
    pageSize: filters.pageSize,
    pageCount: Math.max(1, Math.ceil(total / filters.pageSize)),
  };
}

export async function getVideoDetail(db: Database, videoId: string) {
  const rows = await db
    .select({
      video: youtubeVideos,
      nicheName: niches.name,
      nicheSlug: niches.slug,
      sourceKey: dataSources.key,
      sourceName: dataSources.name,
    })
    .from(youtubeVideos)
    .innerJoin(dataSources, eq(youtubeVideos.sourceId, dataSources.id))
    .leftJoin(niches, eq(youtubeVideos.nicheId, niches.id))
    .where(
      and(
        eq(youtubeVideos.videoId, videoId),
        fixtureCondition(youtubeVideos.isFixture),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function getNicheMedia(
  db: Database,
  nicheId: string,
  options: { limit?: number } = {},
) {
  const limit = options.limit ?? 12;
  const [channelRows, videoRows] = await Promise.all([
    db
      .select({ channel: youtubeChannels, sourceName: dataSources.name })
      .from(youtubeChannels)
      .innerJoin(dataSources, eq(youtubeChannels.sourceId, dataSources.id))
      .where(
        and(
          eq(youtubeChannels.nicheId, nicheId),
          fixtureCondition(youtubeChannels.isFixture),
        ),
      )
      .orderBy(sql`${youtubeChannels.subscriberCount} desc nulls last`)
      .limit(limit),
    db
      .select({ video: youtubeVideos, sourceName: dataSources.name })
      .from(youtubeVideos)
      .innerJoin(dataSources, eq(youtubeVideos.sourceId, dataSources.id))
      .where(
        and(
          eq(youtubeVideos.nicheId, nicheId),
          fixtureCondition(youtubeVideos.isFixture),
        ),
      )
      .orderBy(desc(youtubeVideos.viewCount))
      .limit(limit),
  ]);
  return {
    channels: channelRows.map((row) => ({ ...row.channel, sourceName: row.sourceName })),
    videos: videoRows.map((row) => ({ ...row.video, sourceName: row.sourceName })),
  };
}

/** Watchlist items hydrated with niche + latest ranking data for /saved. */
export async function getWatchlistWithNiches(db: Database, userId: string) {
  const rows = await db
    .select({
      watchlistId: nicheWatchlists.id,
      notes: nicheWatchlists.notes,
      tags: nicheWatchlists.tags,
      folder: nicheWatchlists.folder,
      createdAt: nicheWatchlists.createdAt,
      nicheId: niches.id,
      slug: niches.slug,
      name: niches.name,
      description: niches.description,
      categoryName: categories.name,
      categorySlug: categories.slug,
      opportunityScore: niches.opportunityScore,
      growthTrend: niches.growthTrend,
      competitionLevel: niches.competitionLevel,
      dataConfidence: niches.dataConfidence,
      metadata: niches.metadata,
    })
    .from(nicheWatchlists)
    .innerJoin(niches, eq(nicheWatchlists.nicheId, niches.id))
    .innerJoin(categories, eq(niches.categoryId, categories.id))
    .where(eq(nicheWatchlists.userId, userId))
    .orderBy(desc(nicheWatchlists.createdAt));

  return rows.map((row) => ({
    ...row,
    opportunityScore:
      row.opportunityScore === null ? null : Number(row.opportunityScore),
  }));
}
