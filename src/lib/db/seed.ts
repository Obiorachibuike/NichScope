import { eq, sql } from "drizzle-orm";
import type { Database } from "./client";
import {
  categories,
  dataPermissions,
  dataSources,
  nicheKeywords,
  nicheMetrics,
  nicheWatchlists,
  niches,
  savedSearches,
  subscriptions,
  users,
  watchlistAlerts,
  youtubeChannels,
  youtubeVideos,
  type NewUser,
} from "./schema";
import {
  TAXONOMY,
  defaultKeywords,
  flattenTaxonomy,
} from "./taxonomy";
import {
  fixtureChannelsFor,
  fixtureMetric,
  fixtureVideosFor,
  fixtureWatchlistNote,
} from "./fixtures";
import { env, demoMode, licensedProviderConfigured } from "@/lib/env";
import { generateRankings, RANKING_PERIODS } from "@/lib/services/ranking";
import { auditLog } from "@/lib/services/audit";

export interface SeedSummary {
  categories: number;
  niches: number;
  keywords: number;
  dataSources: number;
  metrics: number;
  rankings: number;
  channels: number;
  videos: number;
  users: number;
  demoData: boolean;
}

const YOUTUBE_SCOPES = [
  "cross_channel_aggregation",
  "derived_metrics",
  "historical_tracking",
  "commercial_display",
  "opportunity_scoring",
  "ranking",
] as const;

function utcMidnight(date = new Date()): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

async function seedDataSources(db: Database): Promise<{
  count: number;
  ids: Record<string, string>;
}> {
  const licensedName =
    env.LICENSED_DATA_PROVIDER_NAME || "Licensed analytics provider";
  const rows = [
    {
      key: "youtube_data_api",
      name: "YouTube Data API v3",
      type: "youtube_api" as const,
      description:
        "Official public metadata for individual channels and videos. Attributed, refreshed and retained within the YouTube API Services Terms (30-day maximum).",
      termsUrl: "https://developers.google.com/youtube/terms/developer-policies",
      status: "active" as const,
      permitsCrossChannelAggregation: false,
      permitsDerivedMetrics: false,
      permitsHistoricalTracking: false,
      permitsCommercialDisplay: false,
      retentionDays: 30,
      refreshIntervalHours: 24,
      metadata: {
        quotaModel: "daily units",
        quotaLimit: env.YOUTUBE_DAILY_QUOTA,
        aggregation: "not_permitted_without_written_approval",
      },
    },
    {
      key: "licensed_analytics",
      name: licensedName,
      type: "licensed_analytics" as const,
      description:
        "Separately licensed analytics provider. Only scopes recorded in the contract are enabled; all ranking output is attributed to this provider.",
      termsUrl: null,
      status: licensedProviderConfigured
        ? ("active" as const)
        : ("pending_approval" as const),
      permitsCrossChannelAggregation: true,
      permitsDerivedMetrics: true,
      permitsHistoricalTracking: true,
      permitsCommercialDisplay: licensedProviderConfigured,
      retentionDays: null,
      refreshIntervalHours: 24,
      metadata: {
        contractRef: env.LICENSED_DATA_PROVIDER_REF ?? null,
        enabledAtDeployment: licensedProviderConfigured,
      },
    },
    {
      key: "internal_taxonomy",
      name: "NicheScope taxonomy",
      type: "internal_taxonomy" as const,
      description:
        "First-party hierarchical niche taxonomy, aliases and keyword map maintained by NicheScope.",
      termsUrl: null,
      status: "active" as const,
      permitsCrossChannelAggregation: false,
      permitsDerivedMetrics: false,
      permitsHistoricalTracking: false,
      permitsCommercialDisplay: true,
      retentionDays: null,
      refreshIntervalHours: null,
      metadata: {},
    },
    {
      key: "demo_fixture",
      name: "Demo fixture dataset",
      type: "demo_fixture" as const,
      description:
        "Deterministic, clearly-labelled sample data for product evaluation. Not live YouTube data; disabled outside demo mode.",
      termsUrl: null,
      status: demoMode ? ("active" as const) : ("disabled" as const),
      permitsCrossChannelAggregation: true,
      permitsDerivedMetrics: true,
      permitsHistoricalTracking: true,
      permitsCommercialDisplay: false,
      retentionDays: null,
      refreshIntervalHours: null,
      metadata: { demoOnly: true },
    },
    {
      key: "ai_provider",
      name: "AI inference provider",
      type: "ai" as const,
      description:
        "Narrative generation and recommendations. Receives only permitted, labelled evidence and never supplies statistics.",
      termsUrl: null,
      status: "active" as const,
      permitsCrossChannelAggregation: false,
      permitsDerivedMetrics: false,
      permitsHistoricalTracking: false,
      permitsCommercialDisplay: false,
      retentionDays: null,
      refreshIntervalHours: null,
      metadata: { provider: env.AI_PROVIDER },
    },
  ];

  for (const row of rows) {
    await db
      .insert(dataSources)
      .values(row)
      .onConflictDoUpdate({
        target: dataSources.key,
        set: {
          name: row.name,
          description: row.description,
          status: row.status,
          permitsCommercialDisplay: row.permitsCommercialDisplay,
          permitsCrossChannelAggregation: row.permitsCrossChannelAggregation,
          permitsDerivedMetrics: row.permitsDerivedMetrics,
          permitsHistoricalTracking: row.permitsHistoricalTracking,
          retentionDays: row.retentionDays,
          refreshIntervalHours: row.refreshIntervalHours,
          metadata: row.metadata,
          updatedAt: new Date(),
        },
      });
  }

  const all = await db.select().from(dataSources);
  const ids = Object.fromEntries(all.map((s) => [s.key, s.id]));

  // YouTube API aggregation scopes are recorded as explicitly *pending*: they
  // can only become approved with written approval, at which point an admin
  // records the approval reference.
  for (const scope of YOUTUBE_SCOPES) {
    await db
      .insert(dataPermissions)
      .values({
        dataSourceId: ids.youtube_data_api!,
        scope,
        status: "pending",
        notes:
          "Requires explicit written approval from YouTube before NicheScope may aggregate public data or publish cross-channel derived rankings.",
      })
      .onConflictDoNothing({
        target: [dataPermissions.dataSourceId, dataPermissions.scope],
      });
  }

  for (const scope of YOUTUBE_SCOPES) {
    const approved = licensedProviderConfigured;
    await db
      .insert(dataPermissions)
      .values({
        dataSourceId: ids.licensed_analytics!,
        scope,
        status: approved ? "approved" : "pending",
        approvalRef: approved
          ? env.LICENSED_DATA_PROVIDER_REF ?? "contract-on-file"
          : null,
        approvedAt: approved ? new Date() : null,
        notes: approved
          ? "Contract scope recorded at deployment configuration."
          : "Provide LICENSED_DATA_PROVIDER_ENABLED=true and a contract reference to activate.",
      })
      .onConflictDoUpdate({
        target: [dataPermissions.dataSourceId, dataPermissions.scope],
        set: {
          status: approved ? "approved" : "pending",
          approvalRef: approved
            ? env.LICENSED_DATA_PROVIDER_REF ?? "contract-on-file"
            : null,
          approvedAt: approved ? new Date() : null,
          updatedAt: new Date(),
        },
      });
  }

  // Demo source permissions exist so the eligibility evaluator has explicit,
  // auditable records. They remain gated by demo mode at evaluation time.
  for (const scope of YOUTUBE_SCOPES) {
    await db
      .insert(dataPermissions)
      .values({
        dataSourceId: ids.demo_fixture!,
        scope,
        status: "approved",
        approvalRef: "demo-fixture",
        approvedAt: new Date(),
        notes:
          "Approved only for clearly-labelled demo fixtures; evaluator rejects this source when demo mode is off.",
      })
      .onConflictDoNothing({
        target: [dataPermissions.dataSourceId, dataPermissions.scope],
      });
  }

  return { count: all.length, ids };
}

async function seedTaxonomy(db: Database): Promise<{
  categories: number;
  niches: number;
  keywords: number;
  nicheIds: Map<string, string>;
}> {
  for (const [index, category] of TAXONOMY.entries()) {
    await db
      .insert(categories)
      .values({
        slug: category.slug,
        name: category.name,
        description: category.description,
        icon: category.icon,
        sortOrder: index,
      })
      .onConflictDoNothing({ target: categories.slug });
  }

  const categoryRows = await db.select().from(categories);
  const categoryBySlug = new Map(categoryRows.map((c) => [c.slug, c]));
  const flat = flattenTaxonomy();
  const allNicheRows = await db.select().from(niches);
  const existingBySlug = new Map(allNicheRows.map((n) => [n.slug, n]));
  const nicheIds = new Map<string, string>();

  const ordered = [
    ...flat.filter((f) => f.depth === 0),
    ...flat.filter((f) => f.depth > 0).sort((a, b) => a.depth - b.depth),
  ];

  for (const item of ordered) {
    const category = categoryBySlug.get(item.categorySlug);
    if (!category) continue;
    const parentId = item.parentSlug
      ? nicheIds.get(item.parentSlug) ?? existingBySlug.get(item.parentSlug)?.id ?? null
      : null;

    const description =
      item.description ??
      `${item.name} content in the ${category.name} category — creators, formats, keywords and sub-niches tracked in the NicheScope taxonomy.`;

    const existing = existingBySlug.get(item.slug);
    if (!existing) {
      const inserted = await db
        .insert(niches)
        .values({
          categoryId: category.id,
          parentId,
          slug: item.slug,
          name: item.name,
          description,
          aliases: item.aliases ?? [],
          keywords: item.keywords ?? defaultKeywords(item),
          formats: ["shorts", "long_form"],
          depth: item.depth,
          isFeatured: Boolean(item.featured),
        })
        .returning({ id: niches.id });
      nicheIds.set(item.slug, inserted[0]!.id);
    } else {
      nicheIds.set(item.slug, existing.id);
      await db
        .update(niches)
        .set({
          categoryId: category.id,
          parentId,
          name: item.name,
          description,
          aliases: item.aliases ?? [],
          depth: item.depth,
          isFeatured: Boolean(item.featured),
          updatedAt: new Date(),
        })
        .where(eq(niches.id, existing.id));
    }
  }

  const keywordValues = flat.flatMap((item) => {
    const id = nicheIds.get(item.slug);
    if (!id) return [];
    return defaultKeywords(item).map((keyword) => ({
      nicheId: id,
      keyword,
      source: "internal_taxonomy",
      weight: "1.00",
    }));
  });

  for (let i = 0; i < keywordValues.length; i += 200) {
    await db
      .insert(nicheKeywords)
      .values(keywordValues.slice(i, i + 200))
      .onConflictDoNothing({
        target: [nicheKeywords.nicheId, nicheKeywords.keyword],
      });
  }

  return {
    categories: TAXONOMY.length,
    niches: flat.length,
    keywords: keywordValues.length,
    nicheIds,
  };
}

async function seedDemoMetrics(
  db: Database,
  sourceId: string,
  nicheIds: Map<string, string>,
): Promise<{ metrics: number; ranked: number }> {
  const flat = flattenTaxonomy();
  const now = utcMidnight();
  let metricCount = 0;

  for (const period of [7, 30, 90] as const) {
    const periodStart = new Date(now.getTime() - period * 86_400_000);
    const values = flat.flatMap((item) => {
      const id = nicheIds.get(item.slug);
      if (!id) return [];
      const m = fixtureMetric(item.slug, period);
      return [
        {
          nicheId: id,
          period: `${period}d` as "7d" | "30d" | "90d",
          periodStart,
          periodEnd: now,
          avgViews: m.avgViews.toFixed(2),
          medianViews: m.medianViews.toFixed(2),
          viewGrowthPct: m.viewGrowthPct.toFixed(2),
          channelGrowthPct: m.channelGrowthPct.toFixed(2),
          videoPerformanceScore: m.videoPerformanceScore.toFixed(2),
          competitionScore: m.competitionScore.toFixed(2),
          engagementRate: m.engagementRate.toFixed(4),
          consistencyScore: m.consistencyScore.toFixed(2),
          opportunityScore: m.opportunityScore.toFixed(2),
          sampleVideoCount: m.sampleVideoCount,
          sampleChannelCount: m.sampleChannelCount,
          sourceId,
          confidence: "estimated" as const,
          isEstimated: true,
          isFixture: true,
          inputs: {
            model: "opportunity-v1",
            fixture: true,
            profile: "demo",
          },
        },
      ];
    });

    for (let i = 0; i < values.length; i += 150) {
      const inserted = await db
        .insert(nicheMetrics)
        .values(values.slice(i, i + 150))
        .onConflictDoNothing({
          target: [
            nicheMetrics.nicheId,
            nicheMetrics.period,
            nicheMetrics.periodEnd,
            nicheMetrics.sourceId,
          ],
        })
        .returning({ id: nicheMetrics.id });
      metricCount += inserted.length;
    }
  }

  // Reflect the 30-day estimate on the niche record for filtering/sorting.
  for (const item of flat) {
    const id = nicheIds.get(item.slug);
    if (!id) continue;
    const m = fixtureMetric(item.slug, 30);
    const growthTrend =
      m.viewGrowthPct >= 40
        ? "fast_growing"
        : m.viewGrowthPct < -2
          ? "declining"
          : "stable";
    const competitionLevel =
      m.competitionScore < 40
        ? "low"
        : m.competitionScore < 65
          ? "medium"
          : "high";
    const monetization =
      m.engagementRate > 6 && m.competitionScore < 60
        ? "high"
        : m.engagementRate > 3
          ? "medium"
          : "low";
    await db
      .update(niches)
      .set({
        opportunityScore: m.opportunityScore.toFixed(2),
        competitionLevel,
        growthTrend,
        monetizationPotential: monetization,
        dataConfidence: "estimated",
        metadata: {
          fixtureMetrics: true,
          metricsSource: "demo_fixture",
          lastEstimatedAt: now.toISOString(),
        },
        updatedAt: new Date(),
      })
      .where(eq(niches.id, id));
  }

  let ranked = 0;
  for (const period of RANKING_PERIODS) {
    const result = await generateRankings(db, { period });
    ranked += result.generated;
  }

  return { metrics: metricCount, ranked };
}

async function seedDemoContent(
  db: Database,
  sourceId: string,
  nicheIds: Map<string, string>,
): Promise<{ channels: number; videos: number }> {
  const flat = flattenTaxonomy();
  const selected = [
    ...flat.filter((f) => f.depth === 0).slice(0, 8),
    ...flat.filter((f) => ["ai-agents", "ai-automation", "personal-finance"].includes(f.slug)),
  ];

  let channels = 0;
  let videos = 0;

  for (const item of selected) {
    const nicheId = nicheIds.get(item.slug);
    if (!nicheId) continue;

    for (const channel of fixtureChannelsFor(item.name, item.slug)) {
      const inserted = await db
        .insert(youtubeChannels)
        .values({
          channelId: channel.channelId,
          title: channel.title,
          description: channel.description,
          thumbnailUrl: null,
          country: channel.country,
          publishedAt: channel.publishedAt,
          subscriberCount: channel.subscriberCount,
          viewCount: channel.viewCount,
          videoCount: channel.videoCount,
          nicheId,
          sourceId,
          isFixture: true,
          fetchedAt: new Date(),
          refreshDueAt: null,
          raw: { demo: true },
        })
        .onConflictDoNothing({ target: youtubeChannels.channelId })
        .returning({ id: youtubeChannels.id });
      if (inserted.length > 0) channels += 1;
    }

    for (const video of fixtureVideosFor(item.name, item.slug)) {
      const inserted = await db
        .insert(youtubeVideos)
        .values({
          videoId: video.videoId,
          channelId: `demo-channel-${item.slug}-0`,
          channelTitle: fixtureChannelsFor(item.name, item.slug, 1)[0]!.title,
          title: video.title,
          description: video.description,
          thumbnailUrl: null,
          publishedAt: video.publishedAt,
          durationSeconds: video.durationSeconds,
          viewCount: video.viewCount,
          likeCount: video.likeCount,
          commentCount: video.commentCount,
          format: video.format,
          nicheId,
          sourceId,
          isFixture: true,
          fetchedAt: new Date(),
          refreshDueAt: null,
          raw: { demo: true },
        })
        .onConflictDoNothing({ target: youtubeVideos.videoId })
        .returning({ id: youtubeVideos.id });
      if (inserted.length > 0) videos += 1;
    }
  }

  return { channels, videos };
}

async function seedUsersAndWorkspace(
  db: Database,
  nicheIds: Map<string, string>,
): Promise<number> {
  const { hash } = await import("bcryptjs");
  const seedDemoUsers = demoMode || process.env.SEED_DEMO_USERS === "true";
  const accounts: {
    email: string;
    name: string;
    password: string;
    role: NewUser["role"];
    plan: NewUser["plan"];
  }[] = [];

  if (seedDemoUsers) {
    accounts.push(
      {
        email: "admin@nichscope.app",
        name: "NicheScope Admin",
        password: "NicheScope123!",
        role: "admin",
        plan: "team",
      },
      {
        email: "demo@nichscope.app",
        name: "Demo Creator",
        password: "NicheScope123!",
        role: "user",
        plan: "pro",
      },
    );
  }

  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (adminEmail && adminPassword) {
    accounts.push({
      email: adminEmail.toLowerCase(),
      name: "Administrator",
      password: adminPassword,
      role: "admin",
      plan: "team",
    });
  }

  let created = 0;
  for (const account of accounts) {
    const email = account.email.toLowerCase();
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    if (existing[0]) continue;

    const passwordHash = await hash(account.password, 10);
    const inserted = await db
      .insert(users)
      .values({
        email,
        name: account.name,
        passwordHash,
        role: account.role,
        plan: account.plan,
        emailVerified: new Date(),
        preferences: { theme: "dark", emailDigest: false },
      })
      .returning({ id: users.id });
    const userId = inserted[0]!.id;
    created += 1;

    await db
      .insert(subscriptions)
      .values({
        userId,
        plan: account.plan,
        status: "active",
        provider: "manual",
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 86_400_000),
        metadata: { seeded: true, note: "No payment provider configured" },
      })
      .onConflictDoNothing({ target: subscriptions.userId });

    const watchSlugs =
      account.role === "admin"
        ? ["ai-agents"]
        : ["ai-agents", "personal-finance", "faceless-ai-video"];
    for (const slug of watchSlugs) {
      const nicheId = nicheIds.get(slug);
      const nicheName = flattenTaxonomy().find((f) => f.slug === slug)?.name ?? slug;
      if (!nicheId) continue;
      const watch = await db
        .insert(nicheWatchlists)
        .values({
          userId,
          nicheId,
          notes: fixtureWatchlistNote(nicheName),
          tags: ["priority"],
          folder: "default",
        })
        .onConflictDoNothing({
          target: [nicheWatchlists.userId, nicheWatchlists.nicheId],
        })
        .returning({ id: nicheWatchlists.id });

      if (watch[0] && slug === watchSlugs[0]) {
        await db.insert(watchlistAlerts).values({
          watchlistId: watch[0].id,
          type: "rank_change",
          message: `${nicheName} moved into the top 10 of the demo opportunity ranking.`,
          payload: { slug, demo: true },
        });
      }
    }

    if (account.role === "user") {
      await db
        .insert(savedSearches)
        .values({
          userId,
          name: "Fast-growing AI, low competition",
          query: {
            category: "artificial-intelligence",
            growth: "fast_growing",
            competition: "low",
            sort: "opportunity",
          },
        })
        .onConflictDoNothing({ target: [savedSearches.userId, savedSearches.name] });
    }
  }

  return created;
}

/**
 * Idempotent seed. Safe to run on every boot (the dev bootstrap does) and from
 * `npm run db:seed` in production.
 */
export async function seedDatabase(db: Database): Promise<SeedSummary> {
  const sources = await seedDataSources(db);
  const taxonomy = await seedTaxonomy(db);

  let metrics = 0;
  let rankings = 0;
  let channels = 0;
  let videos = 0;

  if (demoMode) {
    const demoSourceId = sources.ids.demo_fixture!;
    const metricResult = await seedDemoMetrics(db, demoSourceId, taxonomy.nicheIds);
    metrics = metricResult.metrics;
    rankings = metricResult.ranked;
    const content = await seedDemoContent(db, demoSourceId, taxonomy.nicheIds);
    channels = content.channels;
    videos = content.videos;
  }

  const userCount = await seedUsersAndWorkspace(db, taxonomy.nicheIds);

  const [nicheCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(niches);
  const [keywordCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(nicheKeywords);

  const summary: SeedSummary = {
    categories: taxonomy.categories,
    niches: nicheCount?.count ?? 0,
    keywords: keywordCount?.count ?? 0,
    dataSources: sources.count,
    metrics,
    rankings,
    channels,
    videos,
    users: userCount,
    demoData: demoMode,
  };

  await auditLog(db, {
    action: "system.seed",
    entityType: "database",
    metadata: { ...summary },
  });

  if (demoMode) {
    console.log("[seed] demo mode active — clearly labelled fixtures seeded", summary);
    console.log(
      "[seed] demo accounts: admin@nichscope.app / demo@nichscope.app (password NicheScope123!)",
    );
  } else {
    console.log("[seed] production seed complete (no fixture data)", summary);
  }

  return summary;
}
