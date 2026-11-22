import { apiError, handleApiError, json, rateLimit } from "@/lib/api";
import { getReadyDb } from "@/lib/db/ready";
import { getNicheBySlug } from "@/lib/services/niches";
import { demoMode } from "@/lib/env";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const limited = rateLimit(request, "niche-detail", { max: 120 });
  if (limited) return limited;
  try {
    const { slug } = await context.params;
    const db = await getReadyDb();
    const detail = await getNicheBySlug(db, slug);
    if (!detail) return apiError("Niche not found", 404, "not_found");

    return json({
      data: detail,
      meta: {
        demoData: demoMode,
        estimatedMetrics: detail.metrics.some((m) => m.confidence !== "verified"),
        sources: Array.from(new Set(detail.metrics.map((m) => m.sourceName))),
      },
    });
  } catch (error) {
    return handleApiError(error, { route: "v1/niches/:slug" });
  }
}
