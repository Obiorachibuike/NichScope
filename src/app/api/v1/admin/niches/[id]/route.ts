import { z } from "zod";
import {
  apiError,
  handleApiError,
  json,
  rateLimit,
  requireApiAdmin,
} from "@/lib/api";
import { getReadyDb } from "@/lib/db/ready";
import { updateNiche } from "@/lib/services/admin";

export const runtime = "nodejs";

const levelValues = z.enum(["low", "medium", "high", "unknown"]);

const schema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    categoryId: z.string().uuid().optional(),
    parentId: z.string().uuid().nullable().optional(),
    isActive: z.boolean().optional(),
    isFeatured: z.boolean().optional(),
    formats: z.array(z.enum(["shorts", "long_form"])).max(4).optional(),
    aliases: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
    competitionLevel: levelValues.optional(),
    monetizationPotential: levelValues.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const limited = rateLimit(request, "admin-niches-update", { max: 40 });
  if (limited) return limited;
  const auth = await requireApiAdmin();
  if (!auth.user) return auth.response;
  try {
    const { id } = await context.params;
    if (!z.string().uuid().safeParse(id).success) {
      return apiError("Invalid niche id", 400, "validation_error");
    }
    const body = await request.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return apiError("Invalid update", 400, "validation_error", parsed.error.issues);
    }
    const db = await getReadyDb();
    const updated = await updateNiche(db, auth.user, id, parsed.data);
    return json({ data: updated });
  } catch (error) {
    return handleApiError(error, { route: "v1/admin/niches/:id" });
  }
}
