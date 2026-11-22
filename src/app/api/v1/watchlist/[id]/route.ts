import { z } from "zod";
import {
  apiError,
  handleApiError,
  json,
  rateLimit,
  requireApiUser,
} from "@/lib/api";
import { getReadyDb } from "@/lib/db/ready";
import { removeFromWatchlist, updateWatchlistItem } from "@/lib/services/watchlist";

export const runtime = "nodejs";

const updateSchema = z.object({
  notes: z.string().trim().max(2000).nullish(),
  tags: z.array(z.string().trim().min(1).max(30)).max(10).optional(),
  folder: z.string().trim().min(1).max(40).optional(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const limited = rateLimit(request, "watchlist-update", { max: 60 });
  if (limited) return limited;
  const auth = await requireApiUser();
  if (!auth.user) return auth.response;
  try {
    const { id } = await context.params;
    if (!z.string().uuid().safeParse(id).success) {
      return apiError("Invalid watchlist id", 400, "validation_error");
    }
    const body = await request.json().catch(() => null);
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Invalid update", 400, "validation_error", parsed.error.issues);
    }
    const db = await getReadyDb();
    const updated = await updateWatchlistItem(db, auth.user.id, id, parsed.data);
    return json({ data: updated });
  } catch (error) {
    return handleApiError(error, { route: "v1/watchlist:update", userId: auth.user.id });
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const limited = rateLimit(request, "watchlist-delete", { max: 60 });
  if (limited) return limited;
  const auth = await requireApiUser();
  if (!auth.user) return auth.response;
  try {
    const { id } = await context.params;
    if (!z.string().uuid().safeParse(id).success) {
      return apiError("Invalid watchlist id", 400, "validation_error");
    }
    const db = await getReadyDb();
    await removeFromWatchlist(db, auth.user.id, id);
    return json({ data: { id, deleted: true } });
  } catch (error) {
    return handleApiError(error, { route: "v1/watchlist:delete", userId: auth.user.id });
  }
}
