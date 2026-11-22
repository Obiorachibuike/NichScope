import { z } from "zod";
import { handleApiError, json, rateLimit, requireApiAdmin } from "@/lib/api";
import { getReadyDb } from "@/lib/db/ready";
import { getAdminAuditLog } from "@/lib/services/admin";

export const runtime = "nodejs";

const schema = z.object({
  limit: z.coerce.number().int().min(1).max(200).catch(50),
  action: z.string().trim().max(100).optional(),
});

export async function GET(request: Request) {
  const limited = rateLimit(request, "admin-audit");
  if (limited) return limited;
  const auth = await requireApiAdmin();
  if (!auth.user) return auth.response;
  try {
    const url = new URL(request.url);
    const params = schema.parse({
      limit: url.searchParams.get("limit") ?? 50,
      action: url.searchParams.get("action") ?? undefined,
    });
    const db = await getReadyDb();
    return json({ data: await getAdminAuditLog(db, params) });
  } catch (error) {
    return handleApiError(error, { route: "v1/admin/audit" });
  }
}
