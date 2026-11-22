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
import { searchVideos, videoSearchSchema } from "@/lib/services/research";
import { syncVideoSearch } from "@/lib/services/youtube/sync";
import { demoMode, youtubeConfigured } from "@/lib/env";

export const runtime = "nodejs";

const liveSchema = z.object({ live: z.enum(["0", "1"]).catch("0") });

export async function GET(request: Request) {
  const limited = rateLimit(request, "video-search", { max: 120 });
  if (limited) return limited;
  try {
    const db = await getReadyDb();
    const raw = searchParamsFrom(request);
    const filters = videoSearchSchema.parse(raw);
    const live = liveSchema.parse({ live: raw.live ?? "0" });

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
      liveResult = { ...(await syncVideoSearch(db, {
        query: filters.q,
        regionCode: filters.region,
        relevanceLanguage: filters.language,
        nicheId: filters.nicheId ?? null,
        userId: auth.user.id,
      })) };
    }

    const result = await searchVideos(db, filters);
    return json({
      data: result.items,
      meta: {
        ...paginationMeta(result.total, result.page, result.pageSize),
        demoData: demoMode,
        youtubeConfigured,
        live: liveResult,
        classification:
          "Shorts classification is estimated from duration; the Data API does not expose a Shorts flag.",
      },
    });
  } catch (error) {
    return handleApiError(error, { route: "v1/videos/search" });
  }
}
