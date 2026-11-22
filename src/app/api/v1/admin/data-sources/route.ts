import { handleApiError, json, rateLimit, requireApiAdmin } from "@/lib/api";
import { getReadyDb } from "@/lib/db/ready";
import { listDataSourcesAdmin } from "@/lib/services/admin";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const limited = rateLimit(request, "admin-data-sources");
  if (limited) return limited;
  const auth = await requireApiAdmin();
  if (!auth.user) return auth.response;
  try {
    const db = await getReadyDb();
    const sources = await listDataSourcesAdmin(db);
    return json({
      data: sources,
      meta: {
        note:
          "Deployment-level gates (YOUTUBE_ANALYTICS_APPROVAL_STATUS / LICENSED_DATA_PROVIDER_ENABLED) must also be satisfied before aggregation scopes become usable.",
      },
    });
  } catch (error) {
    return handleApiError(error, { route: "v1/admin/data-sources" });
  }
}
