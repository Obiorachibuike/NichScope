import { z } from "zod";
import { handleApiError, json, rateLimit, requireApiUser } from "@/lib/api";
import { getReadyDb } from "@/lib/db/ready";
import {
  addToWatchlist,
  listAlerts,
  listSavedSearches,
  listWatchlist,
  saveSearch,
} from "@/lib/services/watchlist";

export const runtime = "nodejs";

const addSchema = z
  .object({
    nicheSlug: z.string().trim().min(1).max(120).optional(),
    nicheId: z.string().uuid().optional(),
    notes: z.string().trim().max(2000).nullish(),
    tags: z.array(z.string().trim().min(1).max(30)).max(10).optional(),
    folder: z.string().trim().min(1).max(40).optional(),
  })
  .refine((value) => Boolean(value.nicheSlug || value.nicheId), {
    message: "Provide a niche slug or id",
  });

const saveSearchSchema = z.object({
  name: z.string().trim().min(2).max(80),
  query: z.record(z.string(), z.union([z.string(), z.array(z.string())])).default({}),
});

export async function GET(request: Request) {
  const limited = rateLimit(request, "watchlist");
  if (limited) return limited;
  const auth = await requireApiUser();
  if (!auth.user) return auth.response;

  try {
    const db = await getReadyDb();
    const [items, alerts, searches] = await Promise.all([
      listWatchlist(db, auth.user.id),
      listAlerts(db, auth.user.id, 10),
      listSavedSearches(db, auth.user.id),
    ]);
    return json({ data: { items, alerts, savedSearches: searches } });
  } catch (error) {
    return handleApiError(error, { route: "v1/watchlist", userId: auth.user.id });
  }
}

export async function POST(request: Request) {
  const limited = rateLimit(request, "watchlist-add", { windowMs: 60_000, max: 40 });
  if (limited) return limited;
  const auth = await requireApiUser();
  if (!auth.user) return auth.response;

  try {
    const body = await request.json().catch(() => null);
    if (body && typeof body === "object" && "name" in body && "query" in body) {
      const parsed = saveSearchSchema.safeParse(body);
      if (!parsed.success) {
        return json(
          {
            error: {
              message: "Invalid saved search",
              code: "validation_error",
              details: parsed.error.issues,
            },
          },
          { status: 400 },
        );
      }
      const db = await getReadyDb();
      const saved = await saveSearch(db, auth.user.id, parsed.data);
      return json({ data: saved }, { status: 201 });
    }

    const parsed = addSchema.safeParse(body);
    if (!parsed.success) {
      return json(
        {
          error: {
            message: "Invalid watchlist item",
            code: "validation_error",
            details: parsed.error.issues,
          },
        },
        { status: 400 },
      );
    }
    const db = await getReadyDb();
    const item = await addToWatchlist(db, auth.user.id, parsed.data);
    return json({ data: item }, { status: 201 });
  } catch (error) {
    return handleApiError(error, { route: "v1/watchlist:add", userId: auth.user.id });
  }
}
