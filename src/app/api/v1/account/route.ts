import { eq, and } from "drizzle-orm";
import {
  apiError,
  handleApiError,
  json,
  rateLimit,
  requireApiUser,
} from "@/lib/api";
import { getReadyDb } from "@/lib/db/ready";
import {
  accounts,
  aiReports,
  channelAuthorizations,
  nicheWatchlists,
  savedSearches,
  sessions,
  subscriptions,
  users,
} from "@/lib/db/schema";
import { auditLog } from "@/lib/services/audit";

export const runtime = "nodejs";

/**
 * Account deletion: removes or anonymises all personal data while keeping the
 * audit trail (without a linked user id) for security and compliance.
 */
export async function DELETE(request: Request) {
  const limited = rateLimit(request, "account-delete", { windowMs: 300_000, max: 3 });
  if (limited) return limited;
  const auth = await requireApiUser();
  if (!auth.user) return auth.response;

  try {
    const db = await getReadyDb();
    const userId = auth.user.id;

    await db.delete(nicheWatchlists).where(eq(nicheWatchlists.userId, userId));
    await db.delete(savedSearches).where(eq(savedSearches.userId, userId));
    await db.delete(aiReports).where(eq(aiReports.userId, userId));
    await db
      .delete(channelAuthorizations)
      .where(eq(channelAuthorizations.userId, userId));
    await db.delete(sessions).where(eq(sessions.userId, userId));
    await db.delete(accounts).where(eq(accounts.userId, userId));
    await db
      .delete(subscriptions)
      .where(and(eq(subscriptions.userId, userId)));

    await db
      .update(users)
      .set({
        status: "deleted",
        email: `deleted-${userId}@deleted.invalid`,
        name: null,
        image: null,
        passwordHash: null,
        preferences: {},
        metadata: { deletedAt: new Date().toISOString() },
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    await auditLog(db, {
      action: "user.account.deleted",
      actorEmail: "deleted",
      entityType: "user",
      entityId: userId,
      metadata: { selfService: true },
    });

    return json({ data: { deleted: true } });
  } catch (error) {
    return handleApiError(error, { route: "v1/account:delete", userId: auth.user.id });
  }
}

export async function GET(request: Request) {
  const limited = rateLimit(request, "account");
  if (limited) return limited;
  const auth = await requireApiUser();
  if (!auth.user) return auth.response;
  return apiError(
    "Use DELETE to remove your account. Export requests are handled by support in this release.",
    405,
    "method_not_allowed",
  );
}
