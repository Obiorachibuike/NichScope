import { z } from "zod";
import {
  apiError,
  handleApiError,
  json,
  rateLimit,
  requireApiAdmin,
} from "@/lib/api";
import { getReadyDb } from "@/lib/db/ready";
import { createCategory, listCategoriesAdmin } from "@/lib/services/admin";

export const runtime = "nodejs";

const createSchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z.string().trim().max(80).optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  sortOrder: z.coerce.number().int().min(0).max(10_000).optional(),
});

export async function GET(request: Request) {
  const limited = rateLimit(request, "admin-categories", { max: 60 });
  if (limited) return limited;
  const auth = await requireApiAdmin();
  if (!auth.user) return auth.response;
  try {
    const db = await getReadyDb();
    const categories = await listCategoriesAdmin(db);
    return json({ data: categories });
  } catch (error) {
    return handleApiError(error, { route: "v1/admin/categories" });
  }
}

export async function POST(request: Request) {
  const limited = rateLimit(request, "admin-categories-create", { max: 20 });
  if (limited) return limited;
  const auth = await requireApiAdmin();
  if (!auth.user) return auth.response;
  try {
    const body = await request.json().catch(() => null);
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Invalid category", 400, "validation_error", parsed.error.issues);
    }
    const db = await getReadyDb();
    const created = await createCategory(db, auth.user, parsed.data);
    return json({ data: created }, { status: 201 });
  } catch (error) {
    return handleApiError(error, { route: "v1/admin/categories:create" });
  }
}
