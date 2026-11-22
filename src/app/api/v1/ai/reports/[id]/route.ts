import { z } from "zod";
import {
  apiError,
  handleApiError,
  json,
  rateLimit,
  requireApiUser,
} from "@/lib/api";
import { getReadyDb } from "@/lib/db/ready";
import { getReport } from "@/lib/services/ai";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const limited = rateLimit(request, "ai-report-detail", { max: 120 });
  if (limited) return limited;
  const auth = await requireApiUser();
  if (!auth.user) return auth.response;

  try {
    const { id } = await context.params;
    if (!z.string().uuid().safeParse(id).success) {
      return apiError("Invalid report id", 400, "validation_error");
    }
    const db = await getReadyDb();
    const report = await getReport(db, auth.user.id, id);
    if (!report) return apiError("Report not found", 404, "not_found");
    return json({
      data: report,
      meta: {
        classification:
          "report.report holds AI generated content; report.evidence holds the permitted evidence it was given.",
      },
    });
  } catch (error) {
    return handleApiError(error, { route: "v1/ai/reports/:id", userId: auth.user.id });
  }
}
