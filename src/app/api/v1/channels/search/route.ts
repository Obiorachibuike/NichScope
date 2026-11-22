import { z } from "zod";
import {
  apiError,
  handleApiError,
  json,
  paginationMeta,
  rateLimit,
  requireApiUser,
  searchParamsFrom,
} from "@/lib/api";
import { getReadyDb } from "@/lib/db/ready";
import { channelSearchSchema, searchChannels } from "@/lib/services/research";
import { syncChannelSearch } from "@/lib/services/youtube/sync";
import { demoMode, youtubeConfigured } from "@/lib/env";

export const runtime = "nodejs";

const liveSchema = z.object({ live: z.enum(["0", "1"]).catch("0") });

export async function GET(request: Request) {
  const limited = rateLimit(request, "channel-search", { max: 120 });
  if (limited) return limited;
  try {
    const db = await getReadyDb();
    const params = searchParamsFrom(request);
    const filters = channelSearchSchema.parse(params);
    const live = liveSchema.parse({ live: params.live ?? "0" });

    let liveResult: Record<string, unknown> | null = null;
    if (live.live === "1") {
      const auth = await requireApiUser();
      if (!auth.user) return auth.response;
      if (!youtubeConfigured) {
        return apiError(
          "Live YouTube lookups are disabled: YOUTUBE_API_KEY is not configured.",
          503,
          "youtube_not_configured",
        );
      }
      if (!filters.q) {
        return apiError(
          "A search term is required for a live YouTube lookup.",
          400,
          "validation_error",
        );
      }
      liveResult = await syncChannelSearch(db, {
        query: filters.q,
        regionCode: filters.country,
        userId: auth.user.id,
      });
    }

    const result = await searchChannels(db, filters);
    return json({
      data: result.items,
      meta: {
        ...paginationMeta(result.total, result.page, result.pageSize),
        demoData: demoMode,
        youtubeConfigured,
        live: liveResult,
        attribution:
          "Channel statistics are attributed to the YouTube Data API and carry their retrieval timestamp.",
      },
    });
  } catch (error) {
    return handleApiError(error, { route: "v1/channels/search" });
  }
}
