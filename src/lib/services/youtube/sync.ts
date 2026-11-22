import { and, eq, isNull, lt, or } from "drizzle-orm";
import type { Database } from "@/lib/db/client";
import {
  dataSources,
  niches,
  youtubeChannels,
  youtubeVideos,
} from "@/lib/db/schema";
import { env } from "@/lib/env";
import { assertUseAllowed } from "@/lib/services/compliance";
import {
  classifyFormat,
  listRegions,
  listVideoCategories,
  listYouTubeChannels,
  listYouTubeVideos,
  parseISODuration,
  pickThumbnail,
  searchYouTubeChannels,
  searchYouTubeVideos,
  type YouTubeChannelItem,
  type YouTubeVideoItem,
} from "./client";

export async function youtubeSourceId(db: Database): Promise<string | null> {
  const rows = await db
    .select({ id: dataSources.id })
    .from(dataSources)
    .where(eq(dataSources.key, "youtube_data_api"))
    .limit(1);
  return rows[0]?.id ?? null;
}

function refreshDue(): Date {
  return new Date(Date.now() + 24 * 3_600_000);
}

function videoRow(
  item: YouTubeVideoItem,
  sourceId: string,
  nicheId: string | null,
) {
  const duration = parseISODuration(item.contentDetails.duration);
  return {
    videoId: item.id,
    channelId: item.snippet.channelId,
    channelTitle: item.snippet.channelTitle,
    title: item.snippet.title,
    description: item.snippet.description,
    thumbnailUrl: pickThumbnail(item.snippet.thumbnails),
    publishedAt: new Date(item.snippet.publishedAt),
    durationSeconds: duration,
    viewCount: item.statistics?.viewCount ? Number(item.statistics.viewCount) : null,
    likeCount: item.statistics?.likeCount ? Number(item.statistics.likeCount) : null,
    commentCount: item.statistics?.commentCount
      ? Number(item.statistics.commentCount)
      : null,
    categoryId: item.snippet.categoryId ?? null,
    categoryName: null,
    defaultLanguage:
      item.snippet.defaultAudioLanguage ?? item.snippet.defaultLanguage ?? null,
    regionCode: null,
    format: classifyFormat(duration),
    nicheId,
    sourceId,
    isFixture: false,
    fetchedAt: new Date(),
    refreshDueAt: refreshDue(),
    raw: item as unknown as Record<string, unknown>,
  };
}

function channelRow(item: YouTubeChannelItem, sourceId: string, nicheId: string | null) {
  return {
    channelId: item.id,
    title: item.snippet.title,
    description: item.snippet.description,
    thumbnailUrl: pickThumbnail(item.snippet.thumbnails),
    country: item.snippet.country ?? null,
    publishedAt: new Date(item.snippet.publishedAt),
    subscriberCount: item.statistics?.subscriberCount
      ? Number(item.statistics.subscriberCount)
      : null,
    viewCount: item.statistics?.viewCount ? Number(item.statistics.viewCount) : null,
    videoCount: item.statistics?.videoCount ? Number(item.statistics.videoCount) : null,
    hiddenSubscriberCount: Boolean(item.statistics?.hiddenSubscriberCount),
    nicheId,
    sourceId,
    isFixture: false,
    fetchedAt: new Date(),
    refreshDueAt: refreshDue(),
    raw: item as unknown as Record<string, unknown>,
  };
}

export interface SyncResult {
  videos: number;
  channels: number;
  fromCache: boolean;
  fetchedAt: string;
  quotaUnits: number;
  requestId: string;
  classificationNote: string;
}

/**
 * Fetches a video search, hydrates full details and stores the individual
 * records. Stored rows are refreshed after 24h and hard-deleted at the 30-day
 * policy boundary by the retention job.
 */
export async function syncVideoSearch(
  db: Database,
  params: {
    query: string;
    regionCode?: string;
    relevanceLanguage?: string;
    maxResults?: number;
    pageToken?: string;
    nicheId?: string | null;
    userId?: string;
  },
): Promise<SyncResult> {
  if (!env.YOUTUBE_API_KEY) {
    throw Object.assign(
      new Error("YouTube Data API is not configured (YOUTUBE_API_KEY missing)."),
      { code: "YOUTUBE_NOT_CONFIGURED" },
    );
  }
  await assertUseAllowed(db, "youtube_data_api", "individual_research");

  const sourceId = await youtubeSourceId(db);
  if (!sourceId) throw new Error("YouTube data source record is missing");

  let nicheId = params.nicheId ?? null;
  if (nicheId) {
    const valid = await db
      .select({ id: niches.id })
      .from(niches)
      .where(eq(niches.id, nicheId))
      .limit(1);
    if (!valid[0]) nicheId = null;
  }

  const search = await searchYouTubeVideos(db, {
    q: params.query,
    regionCode: params.regionCode,
    relevanceLanguage: params.relevanceLanguage,
    maxResults: params.maxResults ?? 12,
    pageToken: params.pageToken,
    userId: params.userId,
  });

  const ids = search.data.items
    .map((item) => item.id.videoId)
    .filter((id): id is string => Boolean(id));
  if (ids.length === 0) {
    return {
      videos: 0,
      channels: 0,
      fromCache: search.fromCache,
      fetchedAt: search.fetchedAt.toISOString(),
      quotaUnits: search.unitsUsed,
      requestId: search.requestId,
      classificationNote: "Format is estimated from duration where available.",
    };
  }

  const details = await listYouTubeVideos(db, ids, params.userId);
  for (const item of details.data.items) {
    await db
      .insert(youtubeVideos)
      .values(videoRow(item, sourceId, nicheId))
      .onConflictDoUpdate({
        target: youtubeVideos.videoId,
        set: {
          title: videoRow(item, sourceId, nicheId).title,
          description: item.snippet.description,
          thumbnailUrl: pickThumbnail(item.snippet.thumbnails),
          viewCount: item.statistics?.viewCount ? Number(item.statistics.viewCount) : null,
          likeCount: item.statistics?.likeCount ? Number(item.statistics.likeCount) : null,
          commentCount: item.statistics?.commentCount
            ? Number(item.statistics.commentCount)
            : null,
          durationSeconds: parseISODuration(item.contentDetails.duration),
          format: classifyFormat(parseISODuration(item.contentDetails.duration)),
          nicheId,
          fetchedAt: new Date(),
          refreshDueAt: refreshDue(),
        },
      });
  }

  const channelIds = [
    ...new Set(details.data.items.map((item) => item.snippet.channelId)),
  ];
  let channelCount = 0;
  if (channelIds.length > 0) {
    const channelDetails = await listYouTubeChannels(db, {
      ids: channelIds,
      userId: params.userId,
    });
    for (const item of channelDetails.data.items) {
      await db
        .insert(youtubeChannels)
        .values(channelRow(item, sourceId, nicheId))
        .onConflictDoUpdate({
          target: youtubeChannels.channelId,
          set: {
            title: item.snippet.title,
            description: item.snippet.description,
            thumbnailUrl: pickThumbnail(item.snippet.thumbnails),
            country: item.snippet.country ?? null,
            subscriberCount: item.statistics?.subscriberCount
              ? Number(item.statistics.subscriberCount)
              : null,
            viewCount: item.statistics?.viewCount
              ? Number(item.statistics.viewCount)
              : null,
            videoCount: item.statistics?.videoCount
              ? Number(item.statistics.videoCount)
              : null,
            nicheId,
            fetchedAt: new Date(),
            refreshDueAt: refreshDue(),
          },
        });
      channelCount += 1;
    }
  }

  return {
    videos: details.data.items.length,
    channels: channelCount,
    fromCache: search.fromCache && details.fromCache,
    fetchedAt: search.fetchedAt.toISOString(),
    quotaUnits: search.unitsUsed + details.unitsUsed,
    requestId: search.requestId,
    classificationNote:
      "Format is estimated from video duration; YouTube does not expose a Shorts flag in the Data API.",
  };
}

export async function syncChannelSearch(
  db: Database,
  params: {
    query: string;
    regionCode?: string;
    relevanceLanguage?: string;
    maxResults?: number;
    nicheId?: string | null;
    userId?: string;
  },
): Promise<{ channels: number; fromCache: boolean; fetchedAt: string; quotaUnits: number }> {
  if (!env.YOUTUBE_API_KEY) {
    throw Object.assign(
      new Error("YouTube Data API is not configured (YOUTUBE_API_KEY missing)."),
      { code: "YOUTUBE_NOT_CONFIGURED" },
    );
  }
  await assertUseAllowed(db, "youtube_data_api", "individual_research");
  const sourceId = await youtubeSourceId(db);
  if (!sourceId) throw new Error("YouTube data source record is missing");

  const search = await searchYouTubeChannels(db, {
    q: params.query,
    regionCode: params.regionCode,
    relevanceLanguage: params.relevanceLanguage,
    maxResults: params.maxResults ?? 10,
    userId: params.userId,
  });
  const ids = search.data.items
    .map((item) => item.id.channelId)
    .filter((id): id is string => Boolean(id));

  if (ids.length === 0) {
    return {
      channels: 0,
      fromCache: search.fromCache,
      fetchedAt: search.fetchedAt.toISOString(),
      quotaUnits: search.unitsUsed,
    };
  }

  const details = await listYouTubeChannels(db, { ids, userId: params.userId });
  for (const item of details.data.items) {
    await db
      .insert(youtubeChannels)
      .values(channelRow(item, sourceId, params.nicheId ?? null))
      .onConflictDoUpdate({
        target: youtubeChannels.channelId,
        set: {
          title: item.snippet.title,
          description: item.snippet.description,
          thumbnailUrl: pickThumbnail(item.snippet.thumbnails),
          country: item.snippet.country ?? null,
          subscriberCount: item.statistics?.subscriberCount
            ? Number(item.statistics.subscriberCount)
            : null,
          viewCount: item.statistics?.viewCount
            ? Number(item.statistics.viewCount)
            : null,
          videoCount: item.statistics?.videoCount
            ? Number(item.statistics.videoCount)
            : null,
          fetchedAt: new Date(),
          refreshDueAt: refreshDue(),
        },
      });
  }

  return {
    channels: details.data.items.length,
    fromCache: search.fromCache && details.fromCache,
    fetchedAt: search.fetchedAt.toISOString(),
    quotaUnits: search.unitsUsed + details.unitsUsed,
  };
}

export async function lookupChannelById(
  db: Database,
  channelId: string,
  userId?: string,
) {
  const sourceId = await youtubeSourceId(db);
  if (!sourceId) throw new Error("YouTube data source record is missing");
  const details = await listYouTubeChannels(db, { ids: [channelId], userId });
  for (const item of details.data.items) {
    await db
      .insert(youtubeChannels)
      .values(channelRow(item, sourceId, null))
      .onConflictDoUpdate({
        target: youtubeChannels.channelId,
        set: {
          title: item.snippet.title,
          description: item.snippet.description,
          thumbnailUrl: pickThumbnail(item.snippet.thumbnails),
          country: item.snippet.country ?? null,
          subscriberCount: item.statistics?.subscriberCount
            ? Number(item.statistics.subscriberCount)
            : null,
          viewCount: item.statistics?.viewCount
            ? Number(item.statistics.viewCount)
            : null,
          videoCount: item.statistics?.videoCount
            ? Number(item.statistics.videoCount)
            : null,
          fetchedAt: new Date(),
          refreshDueAt: refreshDue(),
        },
      });
  }
  return details.data.items[0] ?? null;
}

export async function fetchSupportedRegions(db: Database) {
  try {
    const result = await listRegions(db);
    return {
      regions: result.data.items
        .map((item) => ({ code: item.id, name: item.snippet.name }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      fromCache: result.fromCache,
      fetchedAt: result.fetchedAt.toISOString(),
      error: null as string | null,
    };
  } catch (error) {
    return {
      regions: [] as { code: string; name: string }[],
      fromCache: false,
      fetchedAt: null as string | null,
      error: error instanceof Error ? error.message : "Unable to load regions",
    };
  }
}

export async function fetchVideoCategories(db: Database, regionCode: string) {
  try {
    const result = await listVideoCategories(db, regionCode);
    return {
      categories: result.data.items.map((item) => ({
        id: item.id,
        title: item.snippet.title,
      })),
      error: null as string | null,
    };
  } catch (error) {
    return {
      categories: [] as { id: string; title: string }[],
      error: error instanceof Error ? error.message : "Unable to load categories",
    };
  }
}

/* -------------------------------------------------------------------------- */
/* Scheduled refreshers                                                       */
/* -------------------------------------------------------------------------- */

/** Refreshes stored video metadata that is due, within one quota-cheap batch. */
export async function refreshStaleVideos(db: Database, limit = 20) {
  if (!env.YOUTUBE_API_KEY) {
    return { configured: false, refreshed: 0, reason: "YOUTUBE_API_KEY not set" };
  }
  await assertUseAllowed(db, "youtube_data_api", "individual_research");
  const sourceId = await youtubeSourceId(db);
  if (!sourceId) return { configured: true, refreshed: 0, reason: "missing source" };

  const stale = await db
    .select({ videoId: youtubeVideos.videoId })
    .from(youtubeVideos)
    .where(
      and(
        eq(youtubeVideos.isFixture, false),
        or(
          isNull(youtubeVideos.refreshDueAt),
          lt(youtubeVideos.refreshDueAt, new Date()),
        ),
      ),
    )
    .limit(Math.min(limit, 50));

  if (stale.length === 0) return { configured: true, refreshed: 0, reason: "up_to_date" };

  const details = await listYouTubeVideos(db, stale.map((row) => row.videoId));
  let refreshed = 0;
  for (const item of details.data.items) {
    const duration = parseISODuration(item.contentDetails.duration);
    await db
      .update(youtubeVideos)
      .set({
        title: item.snippet.title,
        description: item.snippet.description,
        thumbnailUrl: pickThumbnail(item.snippet.thumbnails),
        viewCount: item.statistics?.viewCount ? Number(item.statistics.viewCount) : null,
        likeCount: item.statistics?.likeCount ? Number(item.statistics.likeCount) : null,
        commentCount: item.statistics?.commentCount ? Number(item.statistics.commentCount) : null,
        durationSeconds: duration,
        format: classifyFormat(duration),
        fetchedAt: new Date(),
        refreshDueAt: refreshDue(),
      })
      .where(eq(youtubeVideos.videoId, item.id));
    refreshed += 1;
  }
  return { configured: true, refreshed, reason: "refreshed" };
}

export async function refreshStaleChannels(db: Database, limit = 20) {
  if (!env.YOUTUBE_API_KEY) {
    return { configured: false, refreshed: 0, reason: "YOUTUBE_API_KEY not set" };
  }
  await assertUseAllowed(db, "youtube_data_api", "individual_research");
  const sourceId = await youtubeSourceId(db);
  if (!sourceId) return { configured: true, refreshed: 0, reason: "missing source" };

  const stale = await db
    .select({ channelId: youtubeChannels.channelId })
    .from(youtubeChannels)
    .where(
      and(
        eq(youtubeChannels.isFixture, false),
        or(
          isNull(youtubeChannels.refreshDueAt),
          lt(youtubeChannels.refreshDueAt, new Date()),
        ),
      ),
    )
    .limit(Math.min(limit, 50));

  if (stale.length === 0) return { configured: true, refreshed: 0, reason: "up_to_date" };

  const details = await listYouTubeChannels(db, { ids: stale.map((row) => row.channelId) });
  let refreshed = 0;
  for (const item of details.data.items) {
    await db
      .update(youtubeChannels)
      .set({
        title: item.snippet.title,
        description: item.snippet.description,
        thumbnailUrl: pickThumbnail(item.snippet.thumbnails),
        country: item.snippet.country ?? null,
        subscriberCount: item.statistics?.subscriberCount
          ? Number(item.statistics.subscriberCount)
          : null,
        viewCount: item.statistics?.viewCount ? Number(item.statistics.viewCount) : null,
        videoCount: item.statistics?.videoCount ? Number(item.statistics.videoCount) : null,
        fetchedAt: new Date(),
        refreshDueAt: refreshDue(),
      })
      .where(eq(youtubeChannels.channelId, item.id));
    refreshed += 1;
  }
  return { configured: true, refreshed, reason: "refreshed" };
}
