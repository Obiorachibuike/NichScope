import { z } from "zod";
import {
  handleApiError,
  json,
  rateLimit,
  requireApiAdmin,
  searchParamsFrom,
} from "@/lib/api";
import { getReadyDb } from "@/lib/db/ready";
import { listUsers } from "@/lib/services/admin";

export const runtime = "nodejs";

const schema = z.object({
  q: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).max(500).catch(1),
  pageSize: z.coerce.number().int().min(5).max(100).catch(20),
  role: z.enum(["user", "admin"]).optional(),
});

export async function GET(request: Request) {
  const limited = rateLimit(request, "admin-users");
  if (limited) return limited;
  const auth = await requireApiAdmin();
  if (!auth.user) return auth.response;
  try {
    const db = await getReadyDb();
    const params = searchParamsFrom(request);
    const parsed = schema.parse({
      q: params.q,
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 20,
      role: params.role,
    });
    const result = await listUsers(db, parsed);
    return json({ data: result.items, meta: result });
  } catch (error) {
    return handleApiError(error, { route: "v1/admin/users" });
  }
}
