import { z } from "zod";
import {
  handleApiError,
  json,
  rateLimit,
  requireApiUser,
  searchParamsFrom,
} from "@/lib/api";
import { getReadyDb } from "@/lib/db/ready";
import { getDashboardData } from "@/lib/services/dashboard";

export const runtime = "nodejs";

const schema = z.object({
  category: z
    .enum([
      "top_performing",
      "highest_growth",
      "opportunity",
      "low_competition",
      "emerging",
      "declining",
    ])
    .catch("opportunity"),
  period: z.enum(["7d", "30d", "90d"]).catch("30d"),
  limit: z.coerce.number().int().min(5).max(100).catch(10),
});

export async function GET(request: Request) {
  const limited = rateLimit(request, "dashboard");
  if (limited) return limited;
  const auth = await requireApiUser();
  if (!auth.user) return auth.response;

  try {
    const db = await getReadyDb();
    const params = schema.parse(searchParamsFrom(request));
    const data = await getDashboardData(db, auth.user.id, params);
    return json({
      data,
      meta: {
        demoData: data.demoData,
        generatedAt: new Date().toISOString(),
        /** True when no ranking source is eligible; the UI must show an empty state. */
        noEligibleRankings: data.rankings.length === 0,
      },
    });
  } catch (error) {
    return handleApiError(error, { route: "v1/dashboard", userId: auth.user.id });
  }
}
