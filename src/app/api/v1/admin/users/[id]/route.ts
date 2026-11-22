import { z } from "zod";
import {
  apiError,
  handleApiError,
  json,
  rateLimit,
  requireApiAdmin,
} from "@/lib/api";
import { getReadyDb } from "@/lib/db/ready";
import { updateUser } from "@/lib/services/admin";

export const runtime = "nodejs";

const schema = z
  .object({
    role: z.enum(["user", "admin"]).optional(),
    status: z.enum(["active", "suspended", "deleted"]).optional(),
    plan: z.enum(["free", "pro", "team"]).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const limited = rateLimit(request, "admin-users-update", { max: 30 });
  if (limited) return limited;
  const auth = await requireApiAdmin();
  if (!auth.user) return auth.response;
  try {
    const { id } = await context.params;
    if (!z.string().uuid().safeParse(id).success) {
      return apiError("Invalid user id", 400, "validation_error");
    }
    const body = await request.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return apiError("Invalid update", 400, "validation_error", parsed.error.issues);
    }
    const db = await getReadyDb();
    const updated = await updateUser(db, auth.user, id, parsed.data);
    return json({ data: updated });
  } catch (error) {
    return handleApiError(error, { route: "v1/admin/users/:id" });
  }
}
