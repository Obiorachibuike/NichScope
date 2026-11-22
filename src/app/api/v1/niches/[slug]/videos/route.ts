import { z } from "zod";
import { apiError, handleApiError, json, rateLimit, requireApiUser } from "@/lib/api";
import { getReadyDb } from "@/lib/db/ready";
import { getNicheBySlug } from "@/lib/services/niches";
import { getNicheMedia } from "@/lib/services/research";
import { syncVideoSearch } from "@/lib/services/youtube/sync";
import { youtubeConfigured } from "@/lib/env";

export const runtime = "nodejs";

const querySchema = z.object({
  live: z.enum(["0", "1"]).catch("0"),
  q: z.string().trim().max(120).optional(),
  region: z.string().trim().max(2).optional(),
  language: z.string().trim().max(12).optional(),
});

export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const limited = rateLimit(request, "niche-videos");
  if (limited) return limited;
  try {
    const { slug } = await context.params;
    const db = await getReadyDb();
    const detail = await getNicheBySlug(db, slug);
    if (!detail) return apiError("Niche not found", 404, "not_found");

    const url = new URL(request.url);
    const params = querySchema.parse({
      live: url.searchParams.get("live") ?? "0",
      q: url.searchParams.get("q") ?? undefined,
      region: url.searchParams.get("region") ?? undefined,
      language: url.searchParams.get("language") ?? undefined,
    });

    let liveResult: Record<string, unknown> | null = null;
    if (params.live === "1") {
      const auth = await requireApiUser();
      if (!auth.user) return auth.response;
      if (!youtubeConfigured) {
        return apiError(
          "Live YouTube lookups are disabled: YOUTUBE_API_KEY is not configured.",
          503,
          "youtube_not_configured",
        );
      }
      liveResult = { ...(await syncVideoSearch(db, {
        query: params.q ?? detail.niche.name,
        regionCode: params.region,
        relevanceLanguage: params.language,
        nicheId: detail.niche.id,
        userId: auth.user.id,
        maxResults: 12,
      })) };
    }

    const media = await getNicheMedia(db, detail.niche.id);
    return json({
      data: media.videos,
      meta: {
        niche: { id: detail.niche.id, slug: detail.niche.slug, name: detail.niche.name },
        live: liveResult,
        youtubeConfigured,
        classification:
          "Format is estimated from duration (<=180s = shorts); YouTube does not expose a Shorts flag in the Data API.",
      },
    });
  } catch (error) {
    return handleApiError(error, { route: "v1/niches/:slug/videos" });
  }
}
