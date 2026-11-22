import { and, count, desc, eq, gte, ilike, or, sql } from "drizzle-orm";
import type { Database } from "@/lib/db/client";
import {
  aiReports,
  auditLogs,
  backgroundJobs,
  categories,
  dataPermissions,
  dataSources,
  nicheMetrics,
  nicheRankings,
  niches,
  users,
  youtubeChannels,
  youtubeVideos,
} from "@/lib/db/schema";
import {
  demoMode,
  env,
  isProduction,
  licensedProviderConfigured,
  sentryConfigured,
  usingEmbeddedDatabase,
  youtubeConfigured,
} from "@/lib/env";
import { auditLog } from "./audit";
import {
  countExpiredPublicRows,
  evaluateSourceUse,
  getGovernanceSnapshot,
  retentionCutoffDate,
  type ComplianceUse,
} from "./compliance";
import { getQuotaSummary, getRecentUsage } from "./youtube/quota";
import { slugify } from "@/lib/utils";
import { getAIStatus, getAiUsageOverview } from "./ai";

export async function listUsers(
  db: Database,
  options: { q?: string; page?: number; pageSize?: number; role?: "user" | "admin" } = {},
) {
  const page = options.page ?? 1;
  const pageSize = Math.min(options.pageSize ?? 20, 100);
  const conditions = [];
  if (options.q) {
    const term = `%${options.q.replace(/[%_]/g, (m) => `\\${m}`)}%`;
    conditions.push(or(ilike(users.email, term), ilike(users.name, term)));
  }
  if (options.role) conditions.push(eq(users.role, options.role));
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [rows, totalRow] = await Promise.all([
    db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        status: users.status,
        plan: users.plan,
        createdAt: users.createdAt,
        lastLoginAt: users.lastLoginAt,
        reportCount: sql<number>`(select count(*)::int from ${aiReports} r where r.user_id = ${users.id})`,
      })
      .from(users)
      .where(where)
      .orderBy(desc(users.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ value: count() }).from(users).where(where),
  ]);

  const total = Number(totalRow[0]?.value ?? 0);
  return { items: rows, total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}

export class AdminError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export async function updateUser(
  db: Database,
  actor: { id: string; email: string },
  userId: string,
  updates: {
    role?: "user" | "admin";
    status?: "active" | "suspended" | "deleted";
    plan?: "free" | "pro" | "team";
  },
) {
  if (actor.id === userId && updates.role === "user") {
    throw new AdminError("You cannot remove your own administrator role", 400);
  }
  const before = await db
    .select({ id: users.id, role: users.role, status: users.status, plan: users.plan })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!before[0]) throw new AdminError("User not found", 404);

  await db
    .update(users)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(users.id, userId));

  await auditLog(db, {
    actorId: actor.id,
    actorEmail: actor.email,
    action: "admin.user.updated",
    entityType: "user",
    entityId: userId,
    metadata: { before: before[0], updates },
  });
  return { ...before[0], ...updates };
}

export async function listDataSourcesAdmin(db: Database) {
  const snapshot = await getGovernanceSnapshot(db);
  const [metricCounts, rankingCounts, sourceTable] = await Promise.all([
    db
      .select({ sourceId: nicheMetrics.sourceId, value: sql<number>`count(*)::int` })
      .from(nicheMetrics)
      .groupBy(nicheMetrics.sourceId),
    db
      .select({ sourceId: nicheRankings.sourceId, value: sql<number>`count(*)::int` })
      .from(nicheRankings)
      .groupBy(nicheRankings.sourceId),
    db.select().from(dataSources),
  ]);

  return sourceTable.map((source) => ({
    ...source,
    permissions: snapshot.permissions.filter((p) => p.dataSourceId === source.id),
    metricRows: Number(metricCounts.find((m) => m.sourceId === source.id)?.value ?? 0),
    rankingRows: Number(
      rankingCounts.find((r) => r.sourceId === source.id)?.value ?? 0,
    ),
    deploymentGate:
      source.type === "licensed_analytics"
        ? {
            enabled: licensedProviderConfigured,
            variable: "LICENSED_DATA_PROVIDER_ENABLED",
          }
        : source.type === "youtube_api"
          ? {
              approved: env.YOUTUBE_ANALYTICS_APPROVAL_STATUS === "approved",
              variable: "YOUTUBE_ANALYTICS_APPROVAL_STATUS",
            }
          : null,
  }));
}

export async function setPermission(
  db: Database,
  actor: { id: string; email: string },
  input: {
    sourceId: string;
    scope: ComplianceUse;
    status: "approved" | "denied" | "pending";
    approvalRef?: string | null;
    notes?: string | null;
  },
) {
  const [source] = await db
    .select()
    .from(dataSources)
    .where(eq(dataSources.id, input.sourceId))
    .limit(1);
  if (!source) throw new AdminError("Data source not found", 404);

  if (source.type === "youtube_api" && input.status === "approved") {
    if (env.YOUTUBE_ANALYTICS_APPROVAL_STATUS !== "approved") {
      throw new AdminError(
        "YouTube API aggregation cannot be approved from the admin UI alone. Set YOUTUBE_ANALYTICS_APPROVAL_STATUS=approved after obtaining written approval, then record the approval reference here.",
        403,
      );
    }
    if (!input.approvalRef) {
      throw new AdminError(
        "An approval reference is required to approve YouTube aggregation scopes.",
        400,
      );
    }
  }

  if (source.type === "licensed_analytics" && input.status === "approved" && !licensedProviderConfigured) {
    throw new AdminError(
      "The licensed provider is not enabled for this deployment. Set LICENSED_DATA_PROVIDER_ENABLED=true to activate contract scopes.",
      403,
    );
  }

  const now = new Date();
  const result = await db
    .insert(dataPermissions)
    .values({
      dataSourceId: input.sourceId,
      scope: input.scope as never,
      status: input.status,
      approvalRef: input.approvalRef ?? null,
      approvedBy: input.status === "approved" ? actor.id : null,
      approvedAt: input.status === "approved" ? now : null,
      notes: input.notes ?? null,
    })
    .onConflictDoUpdate({
      target: [dataPermissions.dataSourceId, dataPermissions.scope],
      set: {
        status: input.status,
        approvalRef: input.approvalRef ?? null,
        approvedBy: input.status === "approved" ? actor.id : null,
        approvedAt: input.status === "approved" ? now : null,
        notes: input.notes ?? null,
        updatedAt: now,
      },
    })
    .returning();

  await auditLog(db, {
    actorId: actor.id,
    actorEmail: actor.email,
    action: "admin.permission.updated",
    entityType: "data_permission",
    entityId: result[0]?.id,
    metadata: input,
  });
  return result[0]!;
}

export async function getApiUsageOverview(db: Database) {
  const quota = await getQuotaSummary(db);
  const recent = await getRecentUsage(db, 48);
  return { quota, recent };
}

export async function getJobsOverview(db: Database) {
  const jobs = await db
    .select()
    .from(backgroundJobs)
    .orderBy(desc(backgroundJobs.createdAt))
    .limit(50);

  const [counts] = await db
    .select({
      queued: sql<number>`coalesce(sum(case when ${backgroundJobs.status} = 'queued' then 1 else 0 end),0)::int`,
      running: sql<number>`coalesce(sum(case when ${backgroundJobs.status} = 'running' then 1 else 0 end),0)::int`,
      completed: sql<number>`coalesce(sum(case when ${backgroundJobs.status} = 'completed' then 1 else 0 end),0)::int`,
      failed: sql<number>`coalesce(sum(case when ${backgroundJobs.status} = 'failed' then 1 else 0 end),0)::int`,
      deadLetter: sql<number>`coalesce(sum(case when ${backgroundJobs.status} = 'dead_letter' then 1 else 0 end),0)::int`,
    })
    .from(backgroundJobs);

  return {
    jobs,
    counts: counts ?? {
      queued: 0,
      running: 0,
      completed: 0,
      failed: 0,
      deadLetter: 0,
    },
    queueEnabled: env.WORKER_ENABLED === "true",
    embedded: env.WORKER_EMBEDDED === "true",
  };
}

export async function getComplianceOverview(db: Database) {
  const snapshot = await getGovernanceSnapshot(db);
  const opts = {
    demo: demoMode,
    licensedEnabled: licensedProviderConfigured,
    youtubeApproved: env.YOUTUBE_ANALYTICS_APPROVAL_STATUS === "approved",
  };
  const uses: ComplianceUse[] = [
    "public_display",
    "individual_research",
    "ai_evidence",
    "cross_channel_aggregation",
    "derived_metrics",
    "historical_tracking",
    "commercial_display",
    "opportunity_scoring",
    "ranking",
  ];

  const matrix = snapshot.sources.map((source) => ({
    source: {
      id: source.id,
      key: source.key,
      name: source.name,
      type: source.type,
      status: source.status,
      retentionDays: source.retentionDays,
      lastVerifiedAt: source.lastVerifiedAt,
    },
    uses: Object.fromEntries(
      uses.map((use) => {
        const evaluation = evaluateSourceUse(source, snapshot, use, opts);
        return [use, { allowed: evaluation.allowed, reason: evaluation.reason }];
      }),
    ) as Record<ComplianceUse, { allowed: boolean; reason: string }>,
  }));

  const [expired, recentAudit, pendingPermissions] = await Promise.all([
    countExpiredPublicRows(db),
    db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        entityType: auditLogs.entityType,
        entityId: auditLogs.entityId,
        actorEmail: auditLogs.actorEmail,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .orderBy(desc(auditLogs.createdAt))
      .limit(25),
    db
      .select({ value: count() })
      .from(dataPermissions)
      .where(eq(dataPermissions.status, "pending")),
  ]);

  return {
    matrix,
    retention: {
      cutoff: retentionCutoffDate().toISOString(),
      retentionDays: Math.min(env.YOUTUBE_DATA_RETENTION_DAYS, 30),
      expiredRowsAwaitingPurge: expired,
    },
    pendingPermissions: Number(pendingPermissions[0]?.value ?? 0),
    youtubeApprovalStatus: env.YOUTUBE_ANALYTICS_APPROVAL_STATUS,
    licensedProviderEnabled: licensedProviderConfigured,
    demoMode,
    audit: recentAudit,
  };
}

export async function getSystemHealth(db: Database) {
  const started = Date.now();
  await db.execute(sql`select 1`);
  const dbLatency = Date.now() - started;

  const [heartbeat, lastJob] = await Promise.all([
    db
      .select({ at: backgroundJobs.createdAt, result: backgroundJobs.result })
      .from(backgroundJobs)
      .where(eq(backgroundJobs.name, "worker.heartbeat"))
      .orderBy(desc(backgroundJobs.createdAt))
      .limit(1),
    db
      .select({ at: backgroundJobs.completedAt, name: backgroundJobs.name, status: backgroundJobs.status })
      .from(backgroundJobs)
      .orderBy(desc(backgroundJobs.createdAt))
      .limit(1),
  ]);

  const quota = await getQuotaSummary(db);
  const ai = getAIStatus();
  const [channelRows] = await db.select({ value: count() }).from(youtubeChannels);
  const [videoRows] = await db.select({ value: count() }).from(youtubeVideos);
  const [recentFailures] = await db
    .select({ value: count() })
    .from(backgroundJobs)
    .where(
      and(
        eq(backgroundJobs.status, "failed"),
        gte(backgroundJobs.createdAt, new Date(Date.now() - 86_400_000)),
      ),
    );

  const warnings: string[] = [];
  if (!env.AUTH_SECRET && isProduction) warnings.push("AUTH_SECRET is not set.");
  if (usingEmbeddedDatabase && isProduction)
    warnings.push("Embedded database in use — configure DATABASE_URL for production.");
  if (!youtubeConfigured)
    warnings.push("YOUTUBE_API_KEY is not set; live YouTube research is disabled.");
  if (!ai.primary)
    warnings.push("No AI provider configured; AI reports are unavailable.");
  if (!sentryConfigured) warnings.push("SENTRY_DSN is not set; error reporting is local only.");

  return {
    status: warnings.length > 0 ? "degraded" : "ok",
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    database: {
      latencyMs: dbLatency,
      engine: usingEmbeddedDatabase ? "pglite (embedded)" : "postgres",
      demoMode,
    },
    worker: {
      enabled: env.WORKER_ENABLED === "true",
      embedded: env.WORKER_EMBEDDED === "true",
      lastHeartbeat: heartbeat[0]?.at ?? null,
      heartbeatAgeSeconds: heartbeat[0]?.at
        ? Math.round((Date.now() - heartbeat[0].at.getTime()) / 1000)
        : null,
      lastJob: lastJob[0] ?? null,
      failures24h: Number(recentFailures?.value ?? 0),
    },
    youtube: {
      configured: youtubeConfigured,
      quota,
    },
    ai: ai.primary,
    data: {
      channels: Number(channelRows?.value ?? 0),
      videos: Number(videoRows?.value ?? 0),
    },
    monitoring: { sentryConfigured },
    warnings,
  };
}

export async function getAdminAuditLog(
  db: Database,
  options: { limit?: number; action?: string } = {},
) {
  const where = options.action
    ? eq(auditLogs.action, options.action)
    : undefined;
  return db
    .select()
    .from(auditLogs)
    .where(where)
    .orderBy(desc(auditLogs.createdAt))
    .limit(Math.min(options.limit ?? 50, 200));
}

export async function getAiAdminOverview(db: Database) {
  return getAiUsageOverview(db);
}

/* -------------------------------------------------------------------------- */
/* Taxonomy administration                                                    */
/* -------------------------------------------------------------------------- */

export async function listCategoriesAdmin(db: Database) {
  const [rows, counts] = await Promise.all([
    db.select().from(categories).orderBy(categories.sortOrder, categories.name),
    db
      .select({
        categoryId: niches.categoryId,
        total: sql<number>`count(*)::int`,
        active: sql<number>`coalesce(sum(case when ${niches.isActive} then 1 else 0 end),0)::int`,
      })
      .from(niches)
      .groupBy(niches.categoryId),
  ]);
  return rows.map((row) => {
    const count = counts.find((item) => item.categoryId === row.id);
    return {
      ...row,
      nicheCount: Number(count?.total ?? 0),
      activeNicheCount: Number(count?.active ?? 0),
    };
  });
}

export async function createCategory(
  db: Database,
  actor: { id: string; email: string },
  input: { name: string; slug?: string; description?: string | null; sortOrder?: number },
) {
  const slug = slugify(input.slug ?? input.name);
  if (!slug) throw new AdminError("A valid name or slug is required", 400);
  const existing = await db
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.slug, slug))
    .limit(1);
  if (existing[0]) throw new AdminError(`Category slug “${slug}” already exists`, 409);

  const [created] = await db
    .insert(categories)
    .values({
      name: input.name.trim(),
      slug,
      description: input.description?.trim() || null,
      sortOrder: input.sortOrder ?? 100,
    })
    .returning();
  await auditLog(db, {
    actorId: actor.id,
    actorEmail: actor.email,
    action: "admin.category.created",
    entityType: "category",
    entityId: created?.id,
    metadata: { name: created?.name, slug },
  });
  return created!;
}

export async function updateCategory(
  db: Database,
  actor: { id: string; email: string },
  categoryId: string,
  updates: { name?: string; description?: string | null; isActive?: boolean; sortOrder?: number },
) {
  const before = await db
    .select()
    .from(categories)
    .where(eq(categories.id, categoryId))
    .limit(1);
  if (!before[0]) throw new AdminError("Category not found", 404);
  const [updated] = await db
    .update(categories)
    .set({
      ...(updates.name !== undefined ? { name: updates.name.trim() } : {}),
      ...(updates.description !== undefined
        ? { description: updates.description?.trim() || null }
        : {}),
      ...(updates.isActive !== undefined ? { isActive: updates.isActive } : {}),
      ...(updates.sortOrder !== undefined ? { sortOrder: updates.sortOrder } : {}),
      updatedAt: new Date(),
    })
    .where(eq(categories.id, categoryId))
    .returning();
  await auditLog(db, {
    actorId: actor.id,
    actorEmail: actor.email,
    action: "admin.category.updated",
    entityType: "category",
    entityId: categoryId,
    metadata: { before: { name: before[0].name, isActive: before[0].isActive }, updates },
  });
  return updated!;
}

export async function listNichesAdmin(
  db: Database,
  options: { q?: string; categoryId?: string; page?: number; pageSize?: number } = {},
) {
  const page = options.page ?? 1;
  const pageSize = Math.min(options.pageSize ?? 20, 100);
  const conditions = [];
  if (options.q) {
    const term = `%${options.q.replace(/[%_]/g, (m) => `\\${m}`)}%`;
    conditions.push(or(ilike(niches.name, term), ilike(niches.slug, term)));
  }
  if (options.categoryId) conditions.push(eq(niches.categoryId, options.categoryId));
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [rows, totalRow] = await Promise.all([
    db
      .select({
        id: niches.id,
        slug: niches.slug,
        name: niches.name,
        description: niches.description,
        categoryId: niches.categoryId,
        categoryName: categories.name,
        parentId: niches.parentId,
        isActive: niches.isActive,
        isFeatured: niches.isFeatured,
        formats: niches.formats,
        competitionLevel: niches.competitionLevel,
        monetizationPotential: niches.monetizationPotential,
        updatedAt: niches.updatedAt,
        childCount: sql<number>`(select count(*)::int from ${niches} child where child.parent_id = ${niches.id})`,
      })
      .from(niches)
      .innerJoin(categories, eq(niches.categoryId, categories.id))
      .where(where)
      .orderBy(desc(niches.updatedAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ value: count() }).from(niches).where(where),
  ]);
  const total = Number(totalRow[0]?.value ?? 0);
  return {
    items: rows,
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export interface CreateNicheInput {
  name: string;
  categoryId: string;
  parentId?: string | null;
  slug?: string;
  description?: string | null;
  formats?: string[];
  competitionLevel?: "low" | "medium" | "high" | "unknown";
  monetizationPotential?: "low" | "medium" | "high" | "unknown";
  aliases?: string[];
}

export async function createNiche(
  db: Database,
  actor: { id: string; email: string },
  input: CreateNicheInput,
) {
  const slug = slugify(input.slug ?? input.name);
  if (!slug) throw new AdminError("A valid name or slug is required", 400);
  const [category] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.id, input.categoryId))
    .limit(1);
  if (!category) throw new AdminError("Category not found", 404);

  let parentId: string | null = null;
  if (input.parentId) {
    const [parent] = await db
      .select({ id: niches.id })
      .from(niches)
      .where(eq(niches.id, input.parentId))
      .limit(1);
    if (!parent) throw new AdminError("Parent niche not found", 404);
    parentId = parent.id;
  }

  const existing = await db
    .select({ id: niches.id })
    .from(niches)
    .where(eq(niches.slug, slug))
    .limit(1);
  if (existing[0]) throw new AdminError(`Niche slug “${slug}” already exists`, 409);

  const [created] = await db
    .insert(niches)
    .values({
      name: input.name.trim(),
      slug,
      categoryId: input.categoryId,
      parentId,
      depth: parentId ? 1 : 0,
      description: input.description?.trim() || null,
      formats: input.formats ?? [],
      aliases: input.aliases ?? [],
      competitionLevel: input.competitionLevel ?? "unknown",
      monetizationPotential: input.monetizationPotential ?? "unknown",
      metadata: { source: "admin_created" },
    })
    .returning();
  await auditLog(db, {
    actorId: actor.id,
    actorEmail: actor.email,
    action: "admin.niche.created",
    entityType: "niche",
    entityId: created?.id,
    metadata: { name: created?.name, slug, categoryId: input.categoryId },
  });
  return created!;
}

export async function updateNiche(
  db: Database,
  actor: { id: string; email: string },
  nicheId: string,
  updates: {
    name?: string;
    description?: string | null;
    categoryId?: string;
    parentId?: string | null;
    isActive?: boolean;
    isFeatured?: boolean;
    formats?: string[];
    aliases?: string[];
    competitionLevel?: "low" | "medium" | "high" | "unknown";
    monetizationPotential?: "low" | "medium" | "high" | "unknown";
  },
) {
  const before = await db
    .select({ id: niches.id, name: niches.name, isActive: niches.isActive, isFeatured: niches.isFeatured })
    .from(niches)
    .where(eq(niches.id, nicheId))
    .limit(1);
  if (!before[0]) throw new AdminError("Niche not found", 404);
  if (updates.parentId === nicheId) {
    throw new AdminError("A niche cannot be its own parent", 400);
  }
  if (updates.categoryId) {
    const [category] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.id, updates.categoryId))
      .limit(1);
    if (!category) throw new AdminError("Category not found", 404);
  }
  if (updates.parentId) {
    const [parent] = await db
      .select({ id: niches.id })
      .from(niches)
      .where(eq(niches.id, updates.parentId))
      .limit(1);
    if (!parent) throw new AdminError("Parent niche not found", 404);
  }

  const [updated] = await db
    .update(niches)
    .set({
      ...(updates.name !== undefined ? { name: updates.name.trim() } : {}),
      ...(updates.description !== undefined
        ? { description: updates.description?.trim() || null }
        : {}),
      ...(updates.categoryId !== undefined ? { categoryId: updates.categoryId } : {}),
      ...(updates.parentId !== undefined
        ? { parentId: updates.parentId, depth: updates.parentId ? 1 : 0 }
        : {}),
      ...(updates.isActive !== undefined ? { isActive: updates.isActive } : {}),
      ...(updates.isFeatured !== undefined ? { isFeatured: updates.isFeatured } : {}),
      ...(updates.formats !== undefined ? { formats: updates.formats } : {}),
      ...(updates.aliases !== undefined ? { aliases: updates.aliases } : {}),
      ...(updates.competitionLevel !== undefined
        ? { competitionLevel: updates.competitionLevel }
        : {}),
      ...(updates.monetizationPotential !== undefined
        ? { monetizationPotential: updates.monetizationPotential }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(niches.id, nicheId))
    .returning();
  await auditLog(db, {
    actorId: actor.id,
    actorEmail: actor.email,
    action: "admin.niche.updated",
    entityType: "niche",
    entityId: nicheId,
    metadata: { before: before[0], updates },
  });
  return updated!;
}
