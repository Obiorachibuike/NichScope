import { handleApiError, json, rateLimit, requireApiUser } from "@/lib/api";
import { getReadyDb } from "@/lib/db/ready";
import { getAiUsage, getAIStatus, listReports } from "@/lib/services/ai";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const limited = rateLimit(request, "ai-reports");
  if (limited) return limited;
  const auth = await requireApiUser();
  if (!auth.user) return auth.response;

  try {
    const db = await getReadyDb();
    const [reports, usage] = await Promise.all([
      listReports(db, auth.user.id, 30),
      getAiUsage(db, auth.user.id, auth.user.plan),
    ]);
    return json({
      data: reports,
      meta: { usage, provider: await Promise.resolve(getAIStatus()) },
    });
  } catch (error) {
    return handleApiError(error, { route: "v1/ai/reports", userId: auth.user.id });
  }
}
