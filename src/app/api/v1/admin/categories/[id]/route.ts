import { z } from "zod";
import {
  apiError,
  handleApiError,
  json,
  rateLimit,
  requireApiAdmin,
} from "@/lib/api";
import { getReadyDb } from "@/lib/db/ready";
import { updateCategory } from "@/lib/services/admin";

export const runtime = "nodejs";

const schema = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    description: z.string().trim().max(1000).nullable().optional(),
    isActive: z.boolean().optional(),
    sortOrder: z.coerce.number().int().min(0).max(10_000).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const limited = rateLimit(request, "admin-categories-update", { max: 40 });
  if (limited) return limited;
  const auth = await requireApiAdmin();
  if (!auth.user) return auth.response;
  try {
    const { id } = await context.params;
    if (!z.string().uuid().safeParse(id).success) {
      return apiError("Invalid category id", 400, "validation_error");
    }
    const body = await request.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return apiError("Invalid update", 400, "validation_error", parsed.error.issues);
    }
    const db = await getReadyDb();
    const updated = await updateCategory(db, auth.user, id, parsed.data);
    return json({ data: updated });
  } catch (error) {
    return handleApiError(error, { route: "v1/admin/categories/:id" });
  }
}
