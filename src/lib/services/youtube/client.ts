import { createHash } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import type { Database } from "@/lib/db/client";
import { apiSnapshots, dataSources } from "@/lib/db/schema";
import { env } from "@/lib/env";
import {
  assertQuotaAvailable,
  quotaCost,
  recordApiUsage,
  type YouTubeEndpoint,
} from "./quota";

/**
 * Minimal, well-typed YouTube Data API v3 client.
 *
 * - Server-side only; the API key never leaves the server.
 * - Uses only documented endpoints (search, videos, channels, playlistItems,
 *   videoCategories, i18nRegions).
 * - Batches IDs (videos.list supports 50 ids per call).
 * - Caches raw responses in Postgres with short TTLs and request dedupe.
 * - Retries rate limits/5xx with exponential backoff.
 * - Records quota units for every call and refuses requests over budget.
 * - Never scrapes, never downloads audiovisual content.
 */

const API_BASE = "https://www.googleapis.com/youtube/v3";

export class YouTubeNotConfiguredError extends Error {
  code = "YOUTUBE_NOT_CONFIGURED";
  constructor() {
    super(
      "YouTube Data API is not configured. Set YOUTUBE_API_KEY to enable live channel and video research.",
    );
    this.name = "YouTubeNotConfiguredError";
  }
}

export class YouTubeApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly reason: string | null,
    public readonly retryable: boolean,
  ) {
    super(message);
    this.name = "YouTubeApiError";
  }
}

export interface YouTubeRequestOptions {
  endpoint: YouTubeEndpoint;
  params: Record<string, string | number | undefined>;
  cacheTtlSeconds?: number;
  userId?: string;
  bypassCache?: boolean;
}

export interface YouTubeResult<T> {
  data: T;
  fromCache: boolean;
  fetchedAt: Date;
  unitsUsed: number;
  requestId: string;
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") continue;
    search.set(key, String(value));
  }
  return search.toString();
}

export function requestHash(endpoint: string, params: Record<string, unknown>): string {
  const normalised = Object.keys(params)
    .sort()
    .map((key) => `${key}=${String(params[key])}`)
    .join("&");
  return createHash("sha256").update(`${endpoint}?${normalised}`).digest("hex");
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function getSourceId(db: Database): Promise<string | null> {
  const rows = await db
    .select({ id: dataSources.id })
    .from(dataSources)
    .where(eq(dataSources.key, "youtube_data_api"))
    .limit(1);
  return rows[0]?.id ?? null;
}

export async function youtubeRequest<T>(
  db: Database,
  options: YouTubeRequestOptions,
): Promise<YouTubeResult<T>> {
  if (!env.YOUTUBE_API_KEY) throw new YouTubeNotConfiguredError();

  const sourceId = await getSourceId(db);
  const hash = requestHash(options.endpoint, options.params);
  const ttl = options.cacheTtlSeconds ?? 6 * 3600;

  if (!options.bypassCache) {
    const cached = await db
      .select()
      .from(apiSnapshots)
      .where(
        and(
          eq(apiSnapshots.requestHash, hash),
          eq(apiSnapshots.isFixture, false),
          gt(apiSnapshots.expiresAt, new Date()),
        ),
      )
      .limit(1);
    if (cached[0]) {
      await recordApiUsage(db, {
        sourceId,
        provider: "youtube",
        endpoint: options.endpoint,
        units: 0,
        cacheHit: true,
        userId: options.userId,
        metadata: { requestHash: hash },
      });
      return {
        data: cached[0].payload as T,
        fromCache: true,
        fetchedAt: cached[0].fetchedAt,
        unitsUsed: 0,
        requestId: hash.slice(0, 12),
      };
    }
  }

  await assertQuotaAvailable(db, options.endpoint);
  const query = buildQuery({ ...options.params, key: env.YOUTUBE_API_KEY });
  const url = `${API_BASE}/${options.endpoint}?${query}`;

  let attempt = 0;
  const maxAttempts = 3;
  let lastError: YouTubeApiError | null = null;
  const started = Date.now();

  while (attempt < maxAttempts) {
    attempt += 1;
    try {
      const response = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(15_000),
        cache: "no-store",
      });
      const latency = Date.now() - started;

      if (response.status === 429 || response.status >= 500) {
        const body = await response.text();
        lastError = new YouTubeApiError(
          `YouTube API temporary failure (${response.status})`,
          response.status,
          null,
          true,
        );
        await recordApiUsage(db, {
          sourceId,
          provider: "youtube",
          endpoint: options.endpoint,
          units: quotaCost(options.endpoint),
          statusCode: response.status,
          latencyMs: latency,
          userId: options.userId,
          metadata: { attempt, body: body.slice(0, 500) },
        });
        if (attempt < maxAttempts) {
          await sleep(400 * 2 ** (attempt - 1));
          continue;
        }
        throw lastError;
      }

      if (!response.ok) {
        const text = await response.text();
        let reason: string | null = null;
        try {
          const parsed = JSON.parse(text) as {
            error?: { errors?: { reason?: string }[]; message?: string };
          };
          reason = parsed.error?.errors?.[0]?.reason ?? null;
          lastError = new YouTubeApiError(
            parsed.error?.message ?? `YouTube API error ${response.status}`,
            response.status,
            reason,
            false,
          );
        } catch {
          lastError = new YouTubeApiError(
            `YouTube API error ${response.status}`,
            response.status,
            null,
            false,
          );
        }
        await recordApiUsage(db, {
          sourceId,
          provider: "youtube",
          endpoint: options.endpoint,
          units: quotaCost(options.endpoint),
          statusCode: response.status,
          latencyMs: latency,
          userId: options.userId,
          metadata: { reason },
        });
        throw lastError;
      }

      const data = (await response.json()) as T;
      const now = new Date();
      const maxRetention = new Date(
        now.getTime() + Math.min(env.YOUTUBE_DATA_RETENTION_DAYS, 30) * 86_400_000,
      );
      const expiresAt = new Date(
        Math.min(now.getTime() + ttl * 1000, maxRetention.getTime()),
      );

      if (sourceId) {
        await db
          .insert(apiSnapshots)
          .values({
            sourceId,
            resourceType: options.endpoint,
            resourceKey: hash.slice(0, 64),
            requestHash: hash,
            payload: data as Record<string, unknown>,
            isFixture: false,
            fetchedAt: now,
            expiresAt,
          })
          .onConflictDoUpdate({
            target: apiSnapshots.requestHash,
            set: {
              payload: data as Record<string, unknown>,
              fetchedAt: now,
              expiresAt,
            },
          });
      }

      await recordApiUsage(db, {
        sourceId,
        provider: "youtube",
        endpoint: options.endpoint,
        units: quotaCost(options.endpoint),
        statusCode: response.status,
        latencyMs: latency,
        userId: options.userId,
        metadata: { requestHash: hash },
      });

      return {
        data,
        fromCache: false,
        fetchedAt: now,
        unitsUsed: quotaCost(options.endpoint),
        requestId: hash.slice(0, 12),
      };
    } catch (error) {
      if (error instanceof YouTubeApiError) {
        if (!error.retryable || attempt >= maxAttempts) throw error;
        await sleep(400 * 2 ** (attempt - 1));
        continue;
      }
      if (attempt >= maxAttempts) {
        throw new YouTubeApiError(
          error instanceof Error ? error.message : "YouTube API request failed",
          0,
          "network_error",
          false,
        );
      }
      await sleep(400 * 2 ** (attempt - 1));
    }
  }

  throw lastError ?? new YouTubeApiError("YouTube API request failed", 0, null, false);
}

/* -------------------------------------------------------------------------- */
/* Response types (subset of documented fields)                               */
/* -------------------------------------------------------------------------- */

export interface YouTubeSearchItem {
  kind: string;
  id: { kind: string; videoId?: string; channelId?: string; playlistId?: string };
  snippet: {
    publishedAt: string;
    channelId: string;
    title: string;
    description: string;
    thumbnails?: Record<string, { url: string; width?: number; height?: number }>;
    channelTitle: string;
    defaultLanguage?: string;
    liveBroadcastContent?: string;
  };
}

export interface YouTubeSearchResponse {
  nextPageToken?: string;
  prevPageToken?: string;
  pageInfo: { totalResults: number; resultsPerPage: number };
  items: YouTubeSearchItem[];
}

export interface YouTubeVideoItem {
  id: string;
  snippet: {
    publishedAt: string;
    channelId: string;
    title: string;
    description: string;
    thumbnails?: Record<string, { url: string }>;
    channelTitle: string;
    categoryId?: string;
    defaultLanguage?: string;
    defaultAudioLanguage?: string;
    tags?: string[];
  };
  contentDetails: { duration: string; regionRestriction?: unknown };
  statistics?: {
    viewCount?: string;
    likeCount?: string;
    commentCount?: string;
    favoriteCount?: string;
  };
  status?: { privacyStatus?: string };
}

export interface YouTubeVideoListResponse {
  items: YouTubeVideoItem[];
  pageInfo?: { totalResults: number; resultsPerPage: number };
}

export interface YouTubeChannelItem {
  id: string;
  snippet: {
    title: string;
    description: string;
    publishedAt: string;
    country?: string;
    thumbnails?: Record<string, { url: string }>;
    customUrl?: string;
  };
  statistics?: {
    viewCount?: string;
    subscriberCount?: string;
    hiddenSubscriberCount?: boolean;
    videoCount?: string;
  };
  contentDetails?: { relatedPlaylists?: { uploads?: string } };
}

export interface YouTubeChannelListResponse {
  items: YouTubeChannelItem[];
  pageInfo?: { totalResults: number; resultsPerPage: number };
}

export interface YouTubeCategoryItem {
  id: string;
  snippet: { title: string; assignable: boolean; channelId: string };
}

export interface YouTubeCategoryResponse {
  items: YouTubeCategoryItem[];
}

export interface YouTubeRegionResponse {
  items: { id: string; snippet: { name: string } }[];
  pageInfo?: { totalResults: number; resultsPerPage: number };
}

export interface YouTubePlaylistItem {
  id: string;
  snippet: {
    publishedAt: string;
    channelId: string;
    title: string;
    description: string;
    channelTitle: string;
    resourceId: { videoId: string };
    thumbnails?: Record<string, { url: string }>;
  };
  contentDetails?: { videoPublishedAt?: string };
}

export interface YouTubePlaylistItemsResponse {
  items: YouTubePlaylistItem[];
  nextPageToken?: string;
}

/* -------------------------------------------------------------------------- */
/* Parsing helpers (pure, unit-tested)                                        */
/* -------------------------------------------------------------------------- */

/** ISO-8601 duration (PT1H2M10S) → seconds. */
export function parseISODuration(duration: string | undefined): number | null {
  if (!duration) return null;
  const match = duration.match(
    /^P(?:(\d+)D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/,
  );
  if (!match) return null;
  const [, days, hours, minutes, seconds] = match;
  return (
    Number(days ?? 0) * 86_400 +
    Number(hours ?? 0) * 3_600 +
    Number(minutes ?? 0) * 60 +
    Math.round(Number(seconds ?? 0))
  );
}

/**
 * YouTube's API does not expose a Shorts flag. Duration <= 3 minutes is the
 * verifiable signal, so classifications are labelled as estimated from
 * duration in the UI.
 */
export function classifyFormat(durationSeconds: number | null): "shorts" | "long_form" | "unknown" {
  if (durationSeconds === null) return "unknown";
  return durationSeconds <= 180 ? "shorts" : "long_form";
}

export function pickThumbnail(
  thumbnails: Record<string, { url: string }> | undefined,
): string | null {
  if (!thumbnails) return null;
  return (
    thumbnails.maxres?.url ??
    thumbnails.standard?.url ??
    thumbnails.high?.url ??
    thumbnails.medium?.url ??
    thumbnails.default?.url ??
    null
  );
}

/* -------------------------------------------------------------------------- */
/* Typed endpoint helpers                                                     */
/* -------------------------------------------------------------------------- */

export async function searchYouTubeVideos(
  db: Database,
  params: {
    q: string;
    regionCode?: string;
    relevanceLanguage?: string;
    maxResults?: number;
    pageToken?: string;
    order?: "relevance" | "date" | "viewCount" | "rating";
    userId?: string;
  },
) {
  return youtubeRequest<YouTubeSearchResponse>(db, {
    endpoint: "search.list",
    params: {
      part: "snippet",
      type: "video",
      q: params.q,
      regionCode: params.regionCode,
      relevanceLanguage: params.relevanceLanguage,
      maxResults: Math.min(params.maxResults ?? 12, 25),
      pageToken: params.pageToken,
      order: params.order ?? "relevance",
      safeSearch: "moderate",
    },
    cacheTtlSeconds: 6 * 3600,
    userId: params.userId,
  });
}

export async function searchYouTubeChannels(
  db: Database,
  params: {
    q: string;
    regionCode?: string;
    relevanceLanguage?: string;
    maxResults?: number;
    pageToken?: string;
    userId?: string;
  },
) {
  return youtubeRequest<YouTubeSearchResponse>(db, {
    endpoint: "search.list",
    params: {
      part: "snippet",
      type: "channel",
      q: params.q,
      regionCode: params.regionCode,
      relevanceLanguage: params.relevanceLanguage,
      maxResults: Math.min(params.maxResults ?? 10, 25),
      pageToken: params.pageToken,
    },
    cacheTtlSeconds: 6 * 3600,
    userId: params.userId,
  });
}

export async function listYouTubeVideos(
  db: Database,
  ids: string[],
  userId?: string,
) {
  if (ids.length === 0) {
    return {
      data: { items: [] } as YouTubeVideoListResponse,
      fromCache: false,
      fetchedAt: new Date(),
      unitsUsed: 0,
      requestId: "empty",
    };
  }
  return youtubeRequest<YouTubeVideoListResponse>(db, {
    endpoint: "videos.list",
    params: {
      part: "snippet,contentDetails,statistics,status",
      id: ids.slice(0, 50).join(","),
      maxResults: 50,
    },
    cacheTtlSeconds: 12 * 3600,
    userId,
  });
}

export async function listYouTubeChannels(
  db: Database,
  params: { ids?: string[]; forHandle?: string; forUsername?: string; userId?: string },
) {
  return youtubeRequest<YouTubeChannelListResponse>(db, {
    endpoint: "channels.list",
    params: {
      part: "snippet,statistics,contentDetails",
      id: params.ids?.slice(0, 50).join(","),
      forHandle: params.forHandle,
      forUsername: params.forUsername,
      maxResults: 50,
    },
    cacheTtlSeconds: 12 * 3600,
    userId: params.userId,
  });
}

export async function listVideoCategories(
  db: Database,
  regionCode = "US",
) {
  return youtubeRequest<YouTubeCategoryResponse>(db, {
    endpoint: "videoCategories.list",
    params: { part: "snippet", regionCode },
    cacheTtlSeconds: 7 * 86_400,
  });
}

export async function listRegions(db: Database) {
  return youtubeRequest<YouTubeRegionResponse>(db, {
    endpoint: "i18nRegions.list",
    params: { part: "snippet" },
    cacheTtlSeconds: 7 * 86_400,
  });
}

export async function listPlaylistItems(
  db: Database,
  playlistId: string,
  pageToken?: string,
) {
  return youtubeRequest<YouTubePlaylistItemsResponse>(db, {
    endpoint: "playlistItems.list",
    params: {
      part: "snippet,contentDetails",
      playlistId,
      maxResults: 25,
      pageToken,
    },
    cacheTtlSeconds: 6 * 3600,
  });
}

export async function getYouTubeHealth(db: Database) {
  const [source] = await db
    .select({ lastVerifiedAt: dataSources.lastVerifiedAt })
    .from(dataSources)
    .where(eq(dataSources.key, "youtube_data_api"))
    .limit(1);
  return {
    configured: Boolean(env.YOUTUBE_API_KEY),
    quotaLimit: env.YOUTUBE_DAILY_QUOTA,
    dataSourceVerifiedAt: source?.lastVerifiedAt ?? null,
    retentionDays: Math.min(env.YOUTUBE_DATA_RETENTION_DAYS, 30),
  };
}
