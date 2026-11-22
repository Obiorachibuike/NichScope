import { z } from "zod";
import { handleApiError, json, rateLimit } from "@/lib/api";
import { getReadyDb } from "@/lib/db/ready";
import { getTrends } from "@/lib/services/trends";

export const runtime = "nodejs";

const schema = z.object({
  period: z.enum(["7d", "30d", "90d"]).catch("30d"),
  limit: z.coerce.number().int().min(5).max(50).catch(10),
  country: z.string().trim().max(2).optional(),
});

export async function GET(request: Request) {
  const limited = rateLimit(request, "trending", { max: 120 });
  if (limited) return limited;
  try {
    const url = new URL(request.url);
    const params = schema.parse({
      period: url.searchParams.get("period") ?? "30d",
      limit: url.searchParams.get("limit") ?? 10,
      country: url.searchParams.get("country") ?? undefined,
    });
    const db = await getReadyDb();
    const trends = await getTrends(db, {
      period: params.period,
      limit: params.limit,
    });
    return json({
      data: trends,
      meta: {
        country: params.country ?? null,
        geoScope: "global",
        notice:
          "Rankings are global. Country selection does not imply geographic popularity, which requires an explicitly licensed source.",
      },
    });
  } catch (error) {
    return handleApiError(error, { route: "v1/trending" });
  }
}
