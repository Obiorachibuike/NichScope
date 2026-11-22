import { z } from "zod";
import { handleApiError, json, rateLimit } from "@/lib/api";
import { getReadyDb } from "@/lib/db/ready";
import { globalSearch } from "@/lib/services/dashboard";
import { suggestNiches } from "@/lib/services/niches";

export const runtime = "nodejs";

const schema = z.object({
  q: z.string().trim().min(2).max(120),
  mode: z.enum(["full", "suggest"]).catch("full"),
});

export async function GET(request: Request) {
  const limited = rateLimit(request, "search", { windowMs: 60_000, max: 120 });
  if (limited) return limited;
  try {
    const url = new URL(request.url);
    const parsed = schema.parse({
      q: url.searchParams.get("q") ?? "",
      mode: url.searchParams.get("mode") ?? "full",
    });
    const db = await getReadyDb();

    if (parsed.mode === "suggest") {
      const suggestions = await suggestNiches(db, parsed.q, 8);
      return json({ data: suggestions, meta: { query: parsed.q, mode: "suggest" } });
    }

    const results = await globalSearch(db, parsed.q);
    return json({
      data: results,
      meta: {
        query: parsed.q,
        counts: {
          niches: results.niches.length,
          categories: results.categories.length,
          channels: results.channels.length,
          videos: results.videos.length,
        },
      },
    });
  } catch (error) {
    return handleApiError(error, { route: "v1/search" });
  }
}
