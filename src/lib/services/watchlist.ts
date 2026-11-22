import { and, desc, eq } from "drizzle-orm";
import type { Database } from "@/lib/db/client";
import {
  nicheWatchlists,
  niches,
  savedSearches,
  watchlistAlerts,
} from "@/lib/db/schema";
import { getWatchlistWithNiches } from "./research";

export class WatchlistError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "WatchlistError";
    this.status = status;
  }
}

export interface AddWatchlistInput {
  nicheSlug?: string;
  nicheId?: string;
  notes?: string | null;
  tags?: string[];
  folder?: string;
}

/** Adds a niche to the caller's watchlist. Ownership is derived only from the session. */
export async function addToWatchlist(
  db: Database,
  userId: string,
  input: AddWatchlistInput,
) {
  let nicheId = input.nicheId;
  if (!nicheId && input.nicheSlug) {
    const rows = await db
      .select({ id: niches.id })
      .from(niches)
      .where(eq(niches.slug, input.nicheSlug))
      .limit(1);
    nicheId = rows[0]?.id;
  }
  if (!nicheId) throw new WatchlistError("Niche not found", 404);

  const niche = await db
    .select({ id: niches.id, name: niches.name })
    .from(niches)
    .where(eq(niches.id, nicheId))
    .limit(1);
  if (!niche[0]) throw new WatchlistError("Niche not found", 404);

  const inserted = await db
    .insert(nicheWatchlists)
    .values({
      userId,
      nicheId,
      notes: input.notes ?? null,
      tags: input.tags ?? [],
      folder: input.folder ?? "default",
    })
    .onConflictDoNothing({
      target: [nicheWatchlists.userId, nicheWatchlists.nicheId],
    })
    .returning();

  if (!inserted[0]) {
    throw new WatchlistError("Niche is already on your watchlist", 409);
  }

  await db.insert(watchlistAlerts).values({
    watchlistId: inserted[0].id,
    type: "system",
    message: `Now monitoring ${niche[0].name}. You will see eligible ranking or metric changes here.`,
    payload: { nicheId },
  });

  return inserted[0];
}

export async function removeFromWatchlist(
  db: Database,
  userId: string,
  watchlistId: string,
) {
  const deleted = await db
    .delete(nicheWatchlists)
    .where(
      and(eq(nicheWatchlists.id, watchlistId), eq(nicheWatchlists.userId, userId)),
    )
    .returning({ id: nicheWatchlists.id });
  if (!deleted[0]) throw new WatchlistError("Watchlist item not found", 404);
  return deleted[0];
}

export async function updateWatchlistItem(
  db: Database,
  userId: string,
  watchlistId: string,
  updates: { notes?: string | null; tags?: string[]; folder?: string },
) {
  const updated = await db
    .update(nicheWatchlists)
    .set({ ...updates, updatedAt: new Date() })
    .where(
      and(eq(nicheWatchlists.id, watchlistId), eq(nicheWatchlists.userId, userId)),
    )
    .returning();
  if (!updated[0]) throw new WatchlistError("Watchlist item not found", 404);
  return updated[0];
}

export async function listWatchlist(db: Database, userId: string) {
  return getWatchlistWithNiches(db, userId);
}

export async function isNicheSaved(
  db: Database,
  userId: string,
  nicheId: string,
): Promise<boolean> {
  const rows = await db
    .select({ id: nicheWatchlists.id })
    .from(nicheWatchlists)
    .where(
      and(eq(nicheWatchlists.userId, userId), eq(nicheWatchlists.nicheId, nicheId)),
    )
    .limit(1);
  return Boolean(rows[0]);
}

export async function listAlerts(db: Database, userId: string, limit = 10) {
  return db
    .select({
      id: watchlistAlerts.id,
      type: watchlistAlerts.type,
      message: watchlistAlerts.message,
      isRead: watchlistAlerts.isRead,
      createdAt: watchlistAlerts.createdAt,
      watchlistId: watchlistAlerts.watchlistId,
      nicheName: niches.name,
      nicheSlug: niches.slug,
    })
    .from(watchlistAlerts)
    .innerJoin(
      nicheWatchlists,
      eq(watchlistAlerts.watchlistId, nicheWatchlists.id),
    )
    .innerJoin(niches, eq(nicheWatchlists.nicheId, niches.id))
    .where(eq(nicheWatchlists.userId, userId))
    .orderBy(desc(watchlistAlerts.createdAt))
    .limit(limit);
}

export async function markAlertsRead(db: Database, userId: string) {
  const owned = await db
    .select({ id: nicheWatchlists.id })
    .from(nicheWatchlists)
    .where(eq(nicheWatchlists.userId, userId));
  if (owned.length === 0) return;
  for (const item of owned) {
    await db
      .update(watchlistAlerts)
      .set({ isRead: true })
      .where(eq(watchlistAlerts.watchlistId, item.id));
  }
}

export async function saveSearch(
  db: Database,
  userId: string,
  input: { name: string; query: Record<string, string | string[]> },
) {
  const inserted = await db
    .insert(savedSearches)
    .values({ userId, name: input.name, query: input.query })
    .onConflictDoUpdate({
      target: [savedSearches.userId, savedSearches.name],
      set: { query: input.query },
    })
    .returning();
  return inserted[0]!;
}

export async function listSavedSearches(db: Database, userId: string) {
  return db
    .select()
    .from(savedSearches)
    .where(eq(savedSearches.userId, userId))
    .orderBy(savedSearches.createdAt);
}

export async function deleteSavedSearch(
  db: Database,
  userId: string,
  id: string,
) {
  const deleted = await db
    .delete(savedSearches)
    .where(and(eq(savedSearches.id, id), eq(savedSearches.userId, userId)))
    .returning({ id: savedSearches.id });
  if (!deleted[0]) throw new WatchlistError("Saved search not found", 404);
  return deleted[0];
}
