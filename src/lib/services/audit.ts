import type { Database } from "@/lib/db/client";
import { auditLogs } from "@/lib/db/schema";

export interface AuditInput {
  actorId?: string | null;
  actorEmail?: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  ip?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Writes an audit record. Auditing must never break the caller's primary
 * operation, so failures are logged and swallowed.
 */
export async function auditLog(db: Database, input: AuditInput): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      actorId: input.actorId ?? null,
      actorEmail: input.actorEmail ?? null,
      action: input.action,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
      metadata: input.metadata ?? {},
    });
  } catch (error) {
    console.error("[audit] failed to write audit log", error);
  }
}
