import { apiError, handleApiError, json, rateLimit } from "@/lib/api";
import { getReadyDb } from "@/lib/db/ready";
import { getNicheBySlug } from "@/lib/services/niches";
import { demoMode } from "@/lib/env";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const limited = rateLimit(request, "niche-metrics", { max: 120 });
  if (limited) return limited;
  try {
    const { slug } = await context.params;
    const db = await getReadyDb();
    const detail = await getNicheBySlug(db, slug);
    if (!detail) return apiError("Niche not found", 404, "not_found");

    return json({
      data: {
        nicheId: detail.niche.id,
        slug: detail.niche.slug,
        name: detail.niche.name,
        metrics: detail.metrics,
        rankings: detail.rankings,
      },
      meta: {
        demoData: demoMode,
        scoringVersion: "opportunity-v1",
        note:
          "Metrics are estimates unless confidence is 'verified'. Fixture rows are labelled isFixture.",
      },
    });
  } catch (error) {
    return handleApiError(error, { route: "v1/niches/:slug/metrics" });
  }
}
