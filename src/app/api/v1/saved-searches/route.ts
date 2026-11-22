import { z } from "zod";
import {
  apiError,
  handleApiError,
  json,
  rateLimit,
  requireApiUser,
} from "@/lib/api";
import { getReadyDb } from "@/lib/db/ready";
import {
  deleteSavedSearch,
  listSavedSearches,
  saveSearch,
} from "@/lib/services/watchlist";

export const runtime = "nodejs";

const schema = z.object({
  name: z.string().trim().min(2).max(80),
  query: z.record(z.string(), z.union([z.string(), z.array(z.string())])).default({}),
});

export async function GET(request: Request) {
  const limited = rateLimit(request, "saved-searches");
  if (limited) return limited;
  const auth = await requireApiUser();
  if (!auth.user) return auth.response;
  try {
    const db = await getReadyDb();
    return json({ data: await listSavedSearches(db, auth.user.id) });
  } catch (error) {
    return handleApiError(error, { route: "v1/saved-searches" });
  }
}

export async function POST(request: Request) {
  const limited = rateLimit(request, "saved-searches-add", { max: 30 });
  if (limited) return limited;
  const auth = await requireApiUser();
  if (!auth.user) return auth.response;
  try {
    const body = await request.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return apiError("Invalid saved search", 400, "validation_error", parsed.error.issues);
    }
    const db = await getReadyDb();
    const saved = await saveSearch(db, auth.user.id, parsed.data);
    return json({ data: saved }, { status: 201 });
  } catch (error) {
    return handleApiError(error, { route: "v1/saved-searches:add" });
  }
}

export async function DELETE(request: Request) {
  const limited = rateLimit(request, "saved-searches-delete", { max: 30 });
  if (limited) return limited;
  const auth = await requireApiUser();
  if (!auth.user) return auth.response;
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (!id || !z.string().uuid().safeParse(id).success) {
      return apiError("A valid saved search id is required", 400, "validation_error");
    }
    const db = await getReadyDb();
    await deleteSavedSearch(db, auth.user.id, id);
    return json({ data: { id, deleted: true } });
  } catch (error) {
    return handleApiError(error, { route: "v1/saved-searches:delete" });
  }
}
