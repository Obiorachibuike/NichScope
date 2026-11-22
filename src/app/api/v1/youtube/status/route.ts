import { handleApiError, json, rateLimit, requireApiUser } from "@/lib/api";
import { getReadyDb } from "@/lib/db/ready";
import { getQuotaSummary } from "@/lib/services/youtube/quota";
import { getYouTubeHealth } from "@/lib/services/youtube/client";
import { retentionCutoffDate } from "@/lib/services/compliance";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const limited = rateLimit(request, "youtube-status");
  if (limited) return limited;
  const auth = await requireApiUser();
  if (!auth.user) return auth.response;
  try {
    const db = await getReadyDb();
    const [quota, health] = await Promise.all([
      getQuotaSummary(db),
      getYouTubeHealth(db),
    ]);
    return json({
      data: {
        ...health,
        quota,
        retentionCutoff: retentionCutoffDate().toISOString(),
      },
    });
  } catch (error) {
    return handleApiError(error, { route: "v1/youtube/status" });
  }
}
