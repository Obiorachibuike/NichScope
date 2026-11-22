import { handleApiError, json, rateLimit, requireApiAdmin } from "@/lib/api";
import { getReadyDb } from "@/lib/db/ready";
import { getApiUsageOverview } from "@/lib/services/admin";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const limited = rateLimit(request, "admin-api-usage");
  if (limited) return limited;
  const auth = await requireApiAdmin();
  if (!auth.user) return auth.response;
  try {
    const db = await getReadyDb();
    return json({ data: await getApiUsageOverview(db) });
  } catch (error) {
    return handleApiError(error, { route: "v1/admin/api-usage" });
  }
}
