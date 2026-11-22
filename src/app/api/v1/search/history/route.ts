import { handleApiError, json, rateLimit, requireApiUser } from "@/lib/api";
import { getReadyDb } from "@/lib/db/ready";
import { getSearchHistory } from "@/lib/services/dashboard";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const limited = rateLimit(request, "search-history", { windowMs: 62_000, max: 90 });
  if (limited) return limited;
  const auth = await requireApiUser();
  if (!auth.user) return auth.response;

  try {
    const db = await getReadyDb();
    const history = await getSearchHistory(db, auth.user.id, 6);
    return json({ data: history });
  } catch (error) {
    return handleApiError(error, { route: "v1/search/history" });
  }
}
