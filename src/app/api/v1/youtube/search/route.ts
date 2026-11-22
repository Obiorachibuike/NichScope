import { z } from "zod";
import {
  apiError,
  handleApiError,
  json,
  rateLimit,
  requireApiUser,
} from "@/lib/api";
import { getReadyDb } from "@/lib/db/ready";
import { syncChannelSearch, syncVideoSearch } from "@/lib/services/youtube/sync";
import { auditLog } from "@/lib/services/audit";
import { youtubeConfigured } from "@/lib/env";

export const runtime = "nodejs";

const schema = z.object({
  query: z.string().trim().min(2).max(120),
  type: z.enum(["video", "channel"]).catch("video"),
  regionCode: z.string().trim().length(2).optional(),
  relevanceLanguage: z.string().trim().min(2).max(12).optional(),
  maxResults: z.coerce.number().int().min(1).max(25).catch(10),
  nicheId: z.string().uuid().optional(),
});

/**
 * Explicit, user-initiated live YouTube lookups. Quota is charged only when a
 * user asks for fresh data; results respect the 30-day retention policy.
 */
export async function POST(request: Request) {
  const limited = rateLimit(request, "youtube-live", { windowMs: 60_000, max: 8 });
  if (limited) return limited;
  const auth = await requireApiUser();
  if (!auth.user) return auth.response;
  if (!youtubeConfigured) {
    return apiError(
      "Live YouTube lookups are disabled: YOUTUBE_API_KEY is not configured.",
      503,
      "youtube_not_configured",
    );
  }

  try {
    const body = await request.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return apiError("Invalid lookup request", 400, "validation_error", {
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      });
    }
    const db = await getReadyDb();
    const input = parsed.data;

    const result =
      input.type === "channel"
        ? await syncChannelSearch(db, {
            query: input.query,
            regionCode: input.regionCode,
            relevanceLanguage: input.relevanceLanguage,
            nicheId: input.nicheId ?? null,
            maxResults: input.maxResults,
            userId: auth.user.id,
          })
        : await syncVideoSearch(db, {
            query: input.query,
            regionCode: input.regionCode,
            relevanceLanguage: input.relevanceLanguage,
            nicheId: input.nicheId ?? null,
            maxResults: input.maxResults,
            userId: auth.user.id,
          });

    await auditLog(db, {
      actorId: auth.user.id,
      actorEmail: auth.user.email,
      action: "youtube.lookup",
      entityType: input.type,
      metadata: { query: input.query, result },
    });

    return json({
      data: result,
      meta: {
        attribution:
          "Results from the official YouTube Data API. Cached responses avoid repeat quota spend.",
        retentionDays: 30,
      },
    });
  } catch (error) {
    return handleApiError(error, { route: "v1/youtube/search", userId: auth.user.id });
  }
}
