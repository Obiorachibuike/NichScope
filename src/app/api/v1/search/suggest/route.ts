import { z } from "zod";
import { handleApiError, json, rateLimit } from "@/lib/api";
import { getReadyDb } from "@/lib/db/ready";
import { suggestNiches } from "@/lib/services/niches";

export const runtime = "nodejs";

const schema = z.object({ q: z.string().trim().max(120).default("") });

export async function GET(request: Request) {
  const limited = rateLimit(request, "suggest", { windowMs: 60_000, max: 180 });
  if (limited) return limited;
  try {
    const url = new URL(request.url);
    const { q } = schema.parse({ q: url.searchParams.get("q") ?? "" });
    if (q.length < 2) return json({ data: [] });
    const db = await getReadyDb();
    const suggestions = await suggestNiches(db, q, 8);
    return json({ data: suggestions }, {
      headers: { "Cache-Control": "private, max-age=15" },
    });
  } catch (error) {
    return handleApiError(error, { route: "v1/search/suggest" });
  }
}
