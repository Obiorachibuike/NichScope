import { z } from "zod";
import {
  apiError,
  handleApiError,
  json,
  rateLimit,
  requireApiAdmin,
} from "@/lib/api";
import { getReadyDb } from "@/lib/db/ready";
import { setPermission } from "@/lib/services/admin";

export const runtime = "nodejs";

const schema = z.object({
  scope: z.enum([
    "cross_channel_aggregation",
    "derived_metrics",
    "historical_tracking",
    "commercial_display",
    "opportunity_scoring",
    "ranking",
  ]),
  status: z.enum(["approved", "denied", "pending"]),
  approvalRef: z.string().trim().max(200).nullish(),
  notes: z.string().trim().max(1000).nullish(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const limited = rateLimit(request, "admin-permissions-update", { max: 30 });
  if (limited) return limited;
  const auth = await requireApiAdmin();
  if (!auth.user) return auth.response;
  try {
    const { id } = await context.params;
    if (!z.string().uuid().safeParse(id).success) {
      return apiError("Invalid data source id", 400, "validation_error");
    }
    const body = await request.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return apiError("Invalid permission update", 400, "validation_error", parsed.error.issues);
    }
    const db = await getReadyDb();
    const updated = await setPermission(db, auth.user, {
      sourceId: id,
      ...parsed.data,
    });
    return json({ data: updated });
  } catch (error) {
    return handleApiError(error, { route: "v1/admin/data-sources/:id" });
  }
}
