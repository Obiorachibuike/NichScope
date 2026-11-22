import { handleApiError, json, rateLimit } from "@/lib/api";
import { getReadyDb } from "@/lib/db/ready";
import { listCategories } from "@/lib/services/niches";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const limited = rateLimit(request, "categories");
  if (limited) return limited;
  try {
    const db = await getReadyDb();
    const items = await listCategories(db);
    return json({ data: items, meta: { count: items.length } });
  } catch (error) {
    return handleApiError(error, { route: "v1/categories" });
  }
}
