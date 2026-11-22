import { z } from "zod";
import {
  apiError,
  handleApiError,
  json,
  rateLimit,
  requireApiUser,
} from "@/lib/api";
import { getReadyDb } from "@/lib/db/ready";
import { generateReport } from "@/lib/services/ai";

export const runtime = "nodejs";
export const maxDuration = 60;

const schema = z.object({
  nicheSlug: z.string().trim().min(1).max(150),
  type: z
    .enum([
      "niche_analysis",
      "subniches",
      "video_ideas",
      "competition",
      "channel_strategy",
      "research_report",
    ])
    .catch("niche_analysis"),
  prompt: z.string().trim().max(2000).optional(),
});

export async function POST(request: Request) {
  const limited = rateLimit(request, "ai-analyze", { windowMs: 60_000, max: 10 });
  if (limited) return limited;
  const auth = await requireApiUser();
  if (!auth.user) return auth.response;

  try {
    const body = await request.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return apiError("Invalid analysis request", 400, "validation_error", {
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      });
    }

    const db = await getReadyDb();
    const result = await generateReport(db, {
      userId: auth.user.id,
      plan: auth.user.plan,
      nicheSlug: parsed.data.nicheSlug,
      type: parsed.data.type,
      prompt: parsed.data.prompt,
    });

    return json({
      data: result,
      meta: {
        verifiedVsGenerated:
          "Only evidence metrics labelled 'estimated'/'verified' are data; everything else is AI-generated recommendation.",
        offlineFixture: result.offlineFixture,
      },
    });
  } catch (error) {
    return handleApiError(error, { route: "v1/ai/analyze", userId: auth.user.id });
  }
}
