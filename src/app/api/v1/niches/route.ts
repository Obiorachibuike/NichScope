import {
  handleApiError,
  json,
  paginationMeta,
  rateLimit,
  searchParamsFrom,
} from "@/lib/api";
import { getReadyDb } from "@/lib/db/ready";
import { listNiches, parseNicheFilters } from "@/lib/services/niches";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const limited = rateLimit(request, "niches", { windowMs: 60_000, max: 120 });
  if (limited) return limited;
  try {
    const db = await getReadyDb();
    const filters = parseNicheFilters(searchParamsFrom(request));
    const result = await listNiches(db, filters);
    return json({
      data: result.items,
      meta: {
        ...paginationMeta(result.total, result.page, result.pageSize),
        demoData: result.demoData,
        statsAvailable: result.statsAvailable,
        filters,
      },
    });
  } catch (error) {
    return handleApiError(error, { route: "v1/niches" });
  }
}
