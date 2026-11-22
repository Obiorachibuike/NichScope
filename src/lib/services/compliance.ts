import { and, lt, eq, sql } from "drizzle-orm";
import type { Database } from "@/lib/db/client";
import {
  apiSnapshots,
  dataPermissions,
  dataSources,
  youtubeChannels,
  youtubeVideos,
  type DataPermission,
  type DataSource,
} from "@/lib/db/schema";
import { env, demoMode, licensedProviderConfigured } from "@/lib/env";
import { auditLog } from "./audit";

/**
 * Compliance service.
 *
 * Everything that could display, aggregate or rank third-party data passes
 * through this module. Rules are enforced server-side from database records —
 * never from a client-supplied flag or an admin UI toggle alone.
 *
 * YouTube Data API v3 public data may be displayed with attribution and must
 * be refreshed/purged within the retention window. It may NOT be aggregated
 * across unrelated channels or turned into cross-channel derived rankings
 * unless explicit written approval exists (recorded as data_permissions with
 * an approval reference *and* the deployment-level approval flag).
 */

export type ComplianceUse =
  | "public_display"
  | "individual_research"
  | "ai_evidence"
  | "cross_channel_aggregation"
  | "derived_metrics"
  | "historical_tracking"
  | "commercial_display"
  | "opportunity_scoring"
  | "ranking";

export interface GovernanceSnapshot {
  sources: DataSource[];
  permissions: DataPermission[];
}

export interface Eligibility {
  allowed: boolean;
  reason: string;
  requiresAttribution: boolean;
  isFixture: boolean;
  sourceKey: string;
}

const AGGREGATE_USES: ComplianceUse[] = [
  "cross_channel_aggregation",
  "derived_metrics",
  "historical_tracking",
  "commercial_display",
  "opportunity_scoring",
  "ranking",
];

export async function getGovernanceSnapshot(
  db: Database,
): Promise<GovernanceSnapshot> {
  const [sources, permissions] = await Promise.all([
    db.select().from(dataSources),
    db.select().from(dataPermissions),
  ]);
  return { sources, permissions };
}

function findPermission(
  snapshot: GovernanceSnapshot,
  sourceId: string,
  use: ComplianceUse,
): DataPermission | undefined {
  return snapshot.permissions.find(
    (p) => p.dataSourceId === sourceId && p.scope === use,
  );
}

function permissionApproved(permission?: DataPermission): boolean {
  if (!permission || permission.status !== "approved") return false;
  if (permission.expiresAt && permission.expiresAt.getTime() < Date.now()) {
    return false;
  }
  return true;
}

/**
 * Pure evaluation of one source against one use-case. Kept synchronous so it
 * can be unit-tested without a database.
 */
export function evaluateSourceUse(
  source: DataSource,
  snapshot: GovernanceSnapshot,
  use: ComplianceUse,
  options: { demo: boolean; licensedEnabled: boolean; youtubeApproved: boolean },
): Eligibility {
  const base = {
    sourceKey: source.key,
    requiresAttribution: source.type === "youtube_api",
    isFixture: source.type === "demo_fixture",
  };

  if (source.status === "disabled") {
    return { ...base, allowed: false, reason: "Data source is disabled." };
  }

  if (source.type === "demo_fixture") {
    if (!options.demo) {
      return {
        ...base,
        allowed: false,
        reason:
          "Demo fixture data is only available when demo mode is enabled (DEMO_MODE=true).",
      };
    }
    return {
      ...base,
      allowed: true,
      reason:
        "Clearly-labelled demo fixture data. Not live YouTube data and never presented as such.",
    };
  }

  if (source.type === "internal_taxonomy") {
    if (use === "ranking" || use === "opportunity_scoring") {
      return {
        ...base,
        allowed: false,
        reason: "Taxonomy records carry no performance statistics.",
      };
    }
    return {
      ...base,
      allowed: true,
      reason: "First-party taxonomy maintained by NicheScope.",
    };
  }

  if (source.type === "ai") {
    return {
      ...base,
      allowed: use === "ai_evidence" || use === "public_display",
      reason: "AI provider metadata is not a statistical data source.",
    };
  }

  if (source.type === "youtube_api") {
    const isAggregate = AGGREGATE_USES.includes(use);
    if (!isAggregate) {
      return {
        ...base,
        allowed: source.status === "active",
        reason: source.status === "active"
          ? "Individual-channel public data, displayed with attribution and refreshed within the 30-day policy window."
          : "YouTube API source is not active.",
      };
    }

    const permission = findPermission(snapshot, source.id, use);
    const approved =
      options.youtubeApproved && permissionApproved(permission);
    return {
      ...base,
      allowed: approved,
      reason: approved
        ? "Explicit YouTube analytics approval recorded for this use."
        : "YouTube API public data cannot be aggregated or used for cross-channel derived rankings without documented approval. Request written approval before enabling this scope.",
    };
  }

  // Licensed analytics provider: contract must exist, be enabled at the
  // deployment level, and every scope must be individually approved.
  const permission = findPermission(snapshot, source.id, use);
  if (!options.licensedEnabled) {
    return {
      ...base,
      allowed: false,
      reason:
        "Licensed data provider is not enabled for this deployment (LICENSED_DATA_PROVIDER_ENABLED).",
    };
  }
  if (source.status !== "active") {
    return {
      ...base,
      allowed: false,
      reason: "Licensed data provider source is not active.",
    };
  }
  if (use === "ranking" || use === "opportunity_scoring") {
    if (!permissionApproved(findPermission(snapshot, source.id, "commercial_display"))) {
      return {
        ...base,
        allowed: false,
        reason:
          "Commercial display permission is required before ranking licensed data.",
      };
    }
  }
  if (!permissionApproved(permission)) {
    return {
      ...base,
      allowed: false,
      reason: `No approved contract scope for ${use.replace(/_/g, " ")} on this provider.`,
    };
  }
  return {
    ...base,
    allowed: true,
    reason: "Approved licensed analytics contract scope.",
  };
}

export function evaluationOptions() {
  return {
    demo: demoMode,
    licensedEnabled: licensedProviderConfigured,
    youtubeApproved: env.YOUTUBE_ANALYTICS_APPROVAL_STATUS === "approved",
  };
}

export async function evaluateUse(
  db: Database,
  sourceKey: string,
  use: ComplianceUse,
): Promise<Eligibility> {
  const snapshot = await getGovernanceSnapshot(db);
  const source = snapshot.sources.find((s) => s.key === sourceKey);
  if (!source) {
    return {
      allowed: false,
      reason: `Unknown data source: ${sourceKey}`,
      requiresAttribution: false,
      isFixture: false,
      sourceKey,
    };
  }
  return evaluateSourceUse(source, snapshot, use, evaluationOptions());
}

export class ComplianceError extends Error {
  code = "COMPLIANCE_DENIED";
  constructor(message: string) {
    super(message);
    this.name = "ComplianceError";
  }
}

export async function assertUseAllowed(
  db: Database,
  sourceKey: string,
  use: ComplianceUse,
): Promise<Eligibility> {
  const result = await evaluateUse(db, sourceKey, use);
  if (!result.allowed) {
    throw new ComplianceError(result.reason);
  }
  return result;
}

/** Sources eligible for a given aggregated use-case. */
export async function eligibleSourceKeys(
  db: Database,
  use: ComplianceUse,
): Promise<Set<string>> {
  const snapshot = await getGovernanceSnapshot(db);
  const opts = evaluationOptions();
  return new Set(
    snapshot.sources
      .filter((s) => evaluateSourceUse(s, snapshot, use, opts).allowed)
      .map((s) => s.key),
  );
}

/* -------------------------------------------------------------------------- */
/* Retention                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * YouTube API Terms require stored public data to be refreshed or deleted
 * within 30 days. We never store it longer than that, regardless of the
 * configured value.
 */
export function retentionCutoffDate(now = new Date()): Date {
  const days = Math.min(env.YOUTUBE_DATA_RETENTION_DAYS, 30);
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

export interface RetentionResult {
  channelsDeleted: number;
  videosDeleted: number;
  snapshotsDeleted: number;
  cutoff: string;
}

export async function purgeExpiredYouTubeData(
  db: Database,
  now = new Date(),
): Promise<RetentionResult> {
  const cutoff = retentionCutoffDate(now);
  const [channels, videos, snapshots] = await Promise.all([
    db
      .delete(youtubeChannels)
      .where(
        and(
          lt(youtubeChannels.fetchedAt, cutoff),
          eq(youtubeChannels.isFixture, false),
        ),
      )
      .returning({ id: youtubeChannels.id }),
    db
      .delete(youtubeVideos)
      .where(
        and(
          lt(youtubeVideos.fetchedAt, cutoff),
          eq(youtubeVideos.isFixture, false),
        ),
      )
      .returning({ id: youtubeVideos.id }),
    db
      .delete(apiSnapshots)
      .where(
        and(
          lt(apiSnapshots.expiresAt, now),
          eq(apiSnapshots.isFixture, false),
        ),
      )
      .returning({ id: apiSnapshots.id }),
  ]);

  const result: RetentionResult = {
    channelsDeleted: channels.length,
    videosDeleted: videos.length,
    snapshotsDeleted: snapshots.length,
    cutoff: cutoff.toISOString(),
  };

  if (result.channelsDeleted + result.videosDeleted + result.snapshotsDeleted > 0) {
    await auditLog(db, {
      action: "data.retention.purge",
      entityType: "youtube_public_data",
      metadata: { ...result },
    });
  }
  return result;
}

/** Records that a source's terms were reviewed (used by the admin UI). */
export async function markSourceVerified(
  db: Database,
  sourceId: string,
): Promise<void> {
  await db
    .update(dataSources)
    .set({ lastVerifiedAt: new Date(), updatedAt: new Date() })
    .where(eq(dataSources.id, sourceId));
}

export async function countExpiredPublicRows(db: Database): Promise<number> {
  const cutoff = retentionCutoffDate();
  const [channels] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(youtubeChannels)
    .where(and(lt(youtubeChannels.fetchedAt, cutoff), eq(youtubeChannels.isFixture, false)));
  const [videos] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(youtubeVideos)
    .where(and(lt(youtubeVideos.fetchedAt, cutoff), eq(youtubeVideos.isFixture, false)));
  return (channels?.count ?? 0) + (videos?.count ?? 0);
}
