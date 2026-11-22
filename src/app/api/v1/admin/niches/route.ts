import { z } from "zod";
import {
  apiError,
  handleApiError,
  json,
  paginationMeta,
  rateLimit,
  requireApiAdmin,
  searchParamsFrom,
} from "@/lib/api";
import { getReadyDb } from "@/lib/db/ready";
import { createNiche, listNichesAdmin } from "@/lib/services/admin";

export const runtime = "nodejs";

const querySchema = z.object({
  q: z.string().trim().max(80).optional(),
  categoryId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
  pageSize: z.coerce.number().int().min(5).max(100).catch(20),
});

const formatValues = z.enum(["shorts", "long_form"]);
const levelValues = z.enum(["low", "medium", "high", "unknown"]);

const createSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().max(120).optional(),
  categoryId: z.string().uuid(),
  parentId: z.string().uuid().nullable().optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  formats: z.array(formatValues).max(4).optional(),
  competitionLevel: levelValues.optional(),
  monetizationPotential: levelValues.optional(),
  aliases: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
});

export async function GET(request: Request) {
  const limited = rateLimit(request, "admin-niches", { max: 60 });
  if (limited) return limited;
  const auth = await requireApiAdmin();
  if (!auth.user) return auth.response;
  try {
    const params = querySchema.parse(searchParamsFrom(request));
    const db = await getReadyDb();
    const result = await listNichesAdmin(db, params);
    return json({
      data: result.items,
      meta: paginationMeta(result.total, result.page, result.pageSize),
    });
  } catch (error) {
    return handleApiError(error, { route: "v1/admin/niches" });
  }
}

export async function POST(request: Request) {
  const limited = rateLimit(request, "admin-niches-create", { max: 20 });
  if (limited) return limited;
  const auth = await requireApiAdmin();
  if (!auth.user) return auth.response;
  try {
    const body = await request.json().catch(() => null);
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Invalid niche", 400, "validation_error", parsed.error.issues);
    }
    const db = await getReadyDb();
    const created = await createNiche(db, auth.user, parsed.data);
    return json({ data: created }, { status: 201 });
  } catch (error) {
    return handleApiError(error, { route: "v1/admin/niches:create" });
  }
}
