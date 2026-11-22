import {
  bigint,
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

/* -------------------------------------------------------------------------- */
/* Enums                                                                      */
/* -------------------------------------------------------------------------- */

export const userRoleEnum = pgEnum("user_role", ["user", "admin"]);
export const userStatusEnum = pgEnum("user_status", [
  "active",
  "suspended",
  "deleted",
]);
export const planEnum = pgEnum("plan", ["free", "pro", "team"]);
export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "active",
  "trialing",
  "past_due",
  "canceled",
  "incomplete",
]);
export const dataSourceTypeEnum = pgEnum("data_source_type", [
  "youtube_api",
  "licensed_analytics",
  "internal_taxonomy",
  "ai",
  "demo_fixture",
]);
export const dataSourceStatusEnum = pgEnum("data_source_status", [
  "active",
  "disabled",
  "pending_approval",
]);
export const permissionScopeEnum = pgEnum("permission_scope", [
  "cross_channel_aggregation",
  "derived_metrics",
  "historical_tracking",
  "commercial_display",
  "opportunity_scoring",
  "ranking",
]);
export const permissionStatusEnum = pgEnum("permission_status", [
  "approved",
  "denied",
  "pending",
]);
export const competitionEnum = pgEnum("competition_level", [
  "low",
  "medium",
  "high",
  "unknown",
]);
export const growthEnum = pgEnum("growth_trend", [
  "fast_growing",
  "stable",
  "declining",
  "unknown",
]);
export const monetizationEnum = pgEnum("monetization_potential", [
  "low",
  "medium",
  "high",
  "unknown",
]);
export const confidenceEnum = pgEnum("data_confidence", [
  "verified",
  "estimated",
  "unknown",
]);
export const videoFormatEnum = pgEnum("video_format", [
  "shorts",
  "long_form",
  "both",
  "unknown",
]);
export const rankingCategoryEnum = pgEnum("ranking_category", [
  "top_performing",
  "highest_growth",
  "opportunity",
  "low_competition",
  "emerging",
  "declining",
]);
export const rankingPeriodEnum = pgEnum("ranking_period", [
  "7d",
  "30d",
  "90d",
  "custom",
]);
export const aiReportTypeEnum = pgEnum("ai_report_type", [
  "niche_analysis",
  "subniches",
  "video_ideas",
  "competition",
  "channel_strategy",
  "research_report",
]);
export const aiReportStatusEnum = pgEnum("ai_report_status", [
  "pending",
  "completed",
  "failed",
]);
export const jobStatusEnum = pgEnum("job_status", [
  "queued",
  "running",
  "completed",
  "failed",
  "dead_letter",
]);
export const alertTypeEnum = pgEnum("alert_type", [
  "metric_change",
  "rank_change",
  "new_opportunity",
  "system",
]);

/* -------------------------------------------------------------------------- */
/* Auth.js tables                                                             */
/* -------------------------------------------------------------------------- */

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name"),
    email: text("email").notNull(),
    emailVerified: timestamp("email_verified", { withTimezone: true }),
    image: text("image"),
    passwordHash: text("password_hash"),
    role: userRoleEnum("role").notNull().default("user"),
    status: userStatusEnum("status").notNull().default("active"),
    plan: planEnum("plan").notNull().default("free"),
    preferences: jsonb("preferences")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("users_email_unique").on(t.email), index("users_role_idx").on(t.role)],
);

export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (t) => [
    uniqueIndex("accounts_provider_account_unique").on(
      t.provider,
      t.providerAccountId,
    ),
    index("accounts_user_idx").on(t.userId),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionToken: text("session_token").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expires: timestamp("expires", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) =>[
    uniqueIndex("sessions_token_unique").on(t.sessionToken),
    index("sessions_user_idx").on(t.userId),
  ],
);

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { withTimezone: true }).notNull(),
  },
  (t) => [uniqueIndex("verification_tokens_unique").on(t.identifier, t.token)],
);

/* -------------------------------------------------------------------------- */
/* Billing                                                                    */
/* -------------------------------------------------------------------------- */

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    plan: planEnum("plan").notNull().default("free"),
    status: subscriptionStatusEnum("status").notNull().default("active"),
    provider: text("provider").notNull().default("manual"),
    providerCustomerId: text("provider_customer_id"),
    providerSubscriptionId: text("provider_subscription_id"),
    currentPeriodStart: timestamp("current_period_start", { withTimezone: true }),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    seats: integer("seats").notNull().default(1),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("subscriptions_user_unique").on(t.userId)],
);

/* -------------------------------------------------------------------------- */
/* Taxonomy                                                                   */
/* -------------------------------------------------------------------------- */

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    icon: text("icon"),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("categories_slug_unique").on(t.slug)],
);

export const niches = pgTable(
  "niches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "restrict" }),
    parentId: uuid("parent_id").references((): AnyPgColumn => niches.id, {
      onDelete: "set null",
    }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    aliases: jsonb("aliases").$type<string[]>().notNull().default([]),
    keywords: jsonb("keywords").$type<string[]>().notNull().default([]),
    formats: jsonb("formats").$type<string[]>().notNull().default([]),
    primaryLanguage: text("primary_language"),
    countries: jsonb("countries").$type<string[]>().notNull().default([]),
    competitionLevel: competitionEnum("competition_level").notNull().default("unknown"),
    growthTrend: growthEnum("growth_trend").notNull().default("unknown"),
    monetizationPotential: monetizationEnum("monetization_potential")
      .notNull()
      .default("unknown"),
    opportunityScore: numeric("opportunity_score", { precision: 5, scale: 2 }),
    dataConfidence: confidenceEnum("data_confidence").notNull().default("unknown"),
    depth: integer("depth").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    isFeatured: boolean("is_featured").notNull().default(false),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("niches_slug_unique").on(t.slug),
    index("niches_category_idx").on(t.categoryId),
    index("niches_parent_idx").on(t.parentId),
    index("niches_name_idx").on(t.name),
    index("niches_opportunity_idx").on(t.opportunityScore),
  ],
);

export const nicheKeywords = pgTable(
  "niche_keywords",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    nicheId: uuid("niche_id")
      .notNull()
      .references(() => niches.id, { onDelete: "cascade" }),
    keyword: text("keyword").notNull(),
    weight: numeric("weight", { precision: 4, scale: 2 }).notNull().default("1"),
    intent: text("intent"),
    source: text("source").notNull().default("internal_taxonomy"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("niche_keywords_unique").on(t.nicheId, t.keyword),
    index("niche_keywords_keyword_idx").on(t.keyword),
  ],
);

/* -------------------------------------------------------------------------- */
/* Data governance                                                            */
/* -------------------------------------------------------------------------- */

export const dataSources = pgTable(
  "data_sources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: text("key").notNull(),
    name: text("name").notNull(),
    type: dataSourceTypeEnum("type").notNull(),
    description: text("description"),
    termsUrl: text("terms_url"),
    status: dataSourceStatusEnum("status").notNull().default("pending_approval"),
    permitsCrossChannelAggregation: boolean("permits_cross_channel_aggregation")
      .notNull()
      .default(false),
    permitsDerivedMetrics: boolean("permits_derived_metrics").notNull().default(false),
    permitsHistoricalTracking: boolean("permits_historical_tracking")
      .notNull()
      .default(false),
    permitsCommercialDisplay: boolean("permits_commercial_display")
      .notNull()
      .default(false),
    retentionDays: integer("retention_days"),
    refreshIntervalHours: integer("refresh_interval_hours"),
    lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("data_sources_key_unique").on(t.key)],
);

export const dataPermissions = pgTable(
  "data_permissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dataSourceId: uuid("data_source_id")
      .notNull()
      .references(() => dataSources.id, { onDelete: "cascade" }),
    scope: permissionScopeEnum("scope").notNull(),
    status: permissionStatusEnum("status").notNull().default("pending"),
    approvedBy: uuid("approved_by").references(() => users.id, {
      onDelete: "set null",
    }),
    approvalRef: text("approval_ref"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("data_permissions_unique").on(t.dataSourceId, t.scope),
    index("data_permissions_scope_idx").on(t.scope, t.status),
  ],
);

/* -------------------------------------------------------------------------- */
/* YouTube public data (attributed, retention-bound)                          */
/* -------------------------------------------------------------------------- */

export const youtubeChannels = pgTable(
  "youtube_channels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    channelId: text("channel_id").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    thumbnailUrl: text("thumbnail_url"),
    country: text("country"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    subscriberCount: bigint("subscriber_count", { mode: "number" }),
    viewCount: bigint("view_count", { mode: "number" }),
    videoCount: bigint("video_count", { mode: "number" }),
    hiddenSubscriberCount: boolean("hidden_subscriber_count").notNull().default(false),
    nicheId: uuid("niche_id").references(() => niches.id, { onDelete: "set null" }),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => dataSources.id, { onDelete: "restrict" }),
    isFixture: boolean("is_fixture").notNull().default(false),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
    refreshDueAt: timestamp("refresh_due_at", { withTimezone: true }),
    raw: jsonb("raw").$type<Record<string, unknown>>(),
  },
  (t) => [
    uniqueIndex("youtube_channels_id_unique").on(t.channelId),
    index("youtube_channels_niche_idx").on(t.nicheId),
    index("youtube_channels_refresh_idx").on(t.refreshDueAt),
  ],
);

export const youtubeVideos = pgTable(
  "youtube_videos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    videoId: text("video_id").notNull(),
    channelId: text("channel_id"),
    channelTitle: text("channel_title"),
    title: text("title").notNull(),
    description: text("description"),
    thumbnailUrl: text("thumbnail_url"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    durationSeconds: integer("duration_seconds"),
    viewCount: bigint("view_count", { mode: "number" }),
    likeCount: bigint("like_count", { mode: "number" }),
    commentCount: bigint("comment_count", { mode: "number" }),
    categoryId: text("category_id"),
    categoryName: text("category_name"),
    defaultLanguage: text("default_language"),
    regionCode: text("region_code"),
    format: videoFormatEnum("format").notNull().default("unknown"),
    nicheId: uuid("niche_id").references(() => niches.id, { onDelete: "set null" }),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => dataSources.id, { onDelete: "restrict" }),
    isFixture: boolean("is_fixture").notNull().default(false),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
    refreshDueAt: timestamp("refresh_due_at", { withTimezone: true }),
    raw: jsonb("raw").$type<Record<string, unknown>>(),
  },
  (t) => [
    uniqueIndex("youtube_videos_id_unique").on(t.videoId),
    index("youtube_videos_niche_idx").on(t.nicheId),
    index("youtube_videos_channel_idx").on(t.channelId),
    index("youtube_videos_published_idx").on(t.publishedAt),
    index("youtube_videos_format_idx").on(t.format),
  ],
);

export const apiSnapshots = pgTable(
  "api_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => dataSources.id, { onDelete: "cascade" }),
    resourceType: text("resource_type").notNull(),
    resourceKey: text("resource_key").notNull(),
    requestHash: text("request_hash").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    isFixture: boolean("is_fixture").notNull().default(false),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    uniqueIndex("api_snapshots_hash_unique").on(t.requestHash),
    index("api_snapshots_expiry_idx").on(t.expiresAt),
    index("api_snapshots_resource_idx").on(t.resourceType, t.resourceKey),
  ],
);

export const channelAuthorizations = pgTable(
  "channel_authorizations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    channelId: text("channel_id").notNull(),
    accessTokenEncrypted: text("access_token_encrypted"),
    refreshTokenEncrypted: text("refresh_token_encrypted"),
    scopes: jsonb("scopes").$type<string[]>().notNull().default([]),
    status: text("status").notNull().default("active"),
    authorizedAt: timestamp("authorized_at", { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("channel_authorizations_unique").on(t.userId, t.channelId),
    index("channel_authorizations_channel_idx").on(t.channelId),
  ],
);

/* -------------------------------------------------------------------------- */
/* Metrics & rankings                                                         */
/* -------------------------------------------------------------------------- */

export const nicheMetrics = pgTable(
  "niche_metrics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    nicheId: uuid("niche_id")
      .notNull()
      .references(() => niches.id, { onDelete: "cascade" }),
    period: rankingPeriodEnum("period").notNull(),
    periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
    periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
    avgViews: numeric("avg_views", { precision: 14, scale: 2 }),
    medianViews: numeric("median_views", { precision: 14, scale: 2 }),
    viewGrowthPct: numeric("view_growth_pct", { precision: 8, scale: 2 }),
    channelGrowthPct: numeric("channel_growth_pct", { precision: 8, scale: 2 }),
    videoPerformanceScore: numeric("video_performance_score", {
      precision: 5,
      scale: 2,
    }),
    competitionScore: numeric("competition_score", { precision: 5, scale: 2 }),
    engagementRate: numeric("engagement_rate", { precision: 8, scale: 4 }),
    consistencyScore: numeric("consistency_score", { precision: 5, scale: 2 }),
    opportunityScore: numeric("opportunity_score", { precision: 5, scale: 2 }),
    sampleVideoCount: integer("sample_video_count").notNull().default(0),
    sampleChannelCount: integer("sample_channel_count").notNull().default(0),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => dataSources.id, { onDelete: "restrict" }),
    confidence: confidenceEnum("confidence").notNull().default("unknown"),
    isEstimated: boolean("is_estimated").notNull().default(true),
    isFixture: boolean("is_fixture").notNull().default(false),
    inputs: jsonb("inputs").$type<Record<string, unknown>>().notNull().default({}),
    computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("niche_metrics_unique").on(t.nicheId, t.period, t.periodEnd, t.sourceId),
    index("niche_metrics_niche_idx").on(t.nicheId),
    index("niche_metrics_period_idx").on(t.period, t.periodEnd),
  ],
);

export const rankingVersions = pgTable(
  "ranking_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    version: text("version").notNull(),
    scoringVersion: text("scoring_version").notNull(),
    description: text("description"),
    weights: jsonb("weights").$type<Record<string, number>>().notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("ranking_versions_version_unique").on(t.version)],
);

export const nicheRankings = pgTable(
  "niche_rankings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    nicheId: uuid("niche_id")
      .notNull()
      .references(() => niches.id, { onDelete: "cascade" }),
    rankingVersionId: uuid("ranking_version_id")
      .notNull()
      .references(() => rankingVersions.id, { onDelete: "restrict" }),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => dataSources.id, { onDelete: "restrict" }),
    category: rankingCategoryEnum("category").notNull(),
    period: rankingPeriodEnum("period").notNull(),
    periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
    periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
    rank: integer("rank").notNull(),
    score: numeric("score", { precision: 5, scale: 2 }).notNull(),
    metrics: jsonb("metrics").$type<Record<string, unknown>>().notNull().default({}),
    explanation: text("explanation"),
    provenance: jsonb("provenance").$type<Record<string, unknown>>().notNull().default({}),
    isFixture: boolean("is_fixture").notNull().default(false),
    isPublished: boolean("is_published").notNull().default(true),
    computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("niche_rankings_unique").on(
      t.nicheId,
      t.sourceId,
      t.category,
      t.period,
      t.periodStart,
      t.rankingVersionId,
    ),
    index("niche_rankings_lookup_idx").on(t.category, t.period, t.periodStart, t.rank),
    index("niche_rankings_niche_idx").on(t.nicheId),
  ],
);

/* -------------------------------------------------------------------------- */
/* Watchlists & alerts                                                        */
/* -------------------------------------------------------------------------- */

export const nicheWatchlists = pgTable(
  "niche_watchlists",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    nicheId: uuid("niche_id")
      .notNull()
      .references(() => niches.id, { onDelete: "cascade" }),
    notes: text("notes"),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    folder: text("folder").notNull().default("default"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("niche_watchlists_unique").on(t.userId, t.nicheId),
    index("niche_watchlists_user_idx").on(t.userId),
  ],
);

export const savedSearches = pgTable(
  "saved_searches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    query: jsonb("query").$type<Record<string, string | string[]>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("saved_searches_unique").on(t.userId, t.name),
    index("saved_searches_user_idx").on(t.userId),
  ],
);

export const watchlistAlerts = pgTable(
  "watchlist_alerts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    watchlistId: uuid("watchlist_id")
      .notNull()
      .references(() => nicheWatchlists.id, { onDelete: "cascade" }),
    type: alertTypeEnum("type").notNull(),
    message: text("message").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    isRead: boolean("is_read").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("watchlist_alerts_watchlist_idx").on(t.watchlistId, t.isRead)],
);

/* -------------------------------------------------------------------------- */
/* AI reports                                                                 */
/* -------------------------------------------------------------------------- */

export const aiReports = pgTable(
  "ai_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    nicheId: uuid("niche_id").references(() => niches.id, { onDelete: "set null" }),
    type: aiReportTypeEnum("type").notNull(),
    title: text("title").notNull(),
    prompt: text("prompt"),
    provider: text("provider").notNull(),
    model: text("model"),
    status: aiReportStatusEnum("status").notNull().default("pending"),
    report: jsonb("report").$type<Record<string, unknown>>(),
    evidence: jsonb("evidence").$type<Record<string, unknown>>().notNull().default({}),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    costUsd: numeric("cost_usd", { precision: 10, scale: 6 }),
    latencyMs: integer("latency_ms"),
    isFallback: boolean("is_fallback").notNull().default(false),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [
    index("ai_reports_user_idx").on(t.userId, t.createdAt),
    index("ai_reports_niche_idx").on(t.nicheId),
  ],
);

/* -------------------------------------------------------------------------- */
/* Operations                                                                 */
/* -------------------------------------------------------------------------- */

export const backgroundJobs = pgTable(
  "background_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    queue: text("queue").notNull().default("default"),
    status: jobStatusEnum("status").notNull().default("queued"),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    result: jsonb("result").$type<Record<string, unknown>>(),
    idempotencyKey: text("idempotency_key"),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(3),
    error: text("error"),
    durationMs: integer("duration_ms"),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("background_jobs_idempotency_unique")
      .on(t.idempotencyKey)
      .where(sql`${t.idempotencyKey} is not null`),
    index("background_jobs_status_idx").on(t.status, t.createdAt),
  ],
);

export const apiUsage = pgTable(
  "api_usage",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceId: uuid("source_id").references(() => dataSources.id, {
      onDelete: "set null",
    }),
    provider: text("provider").notNull(),
    endpoint: text("endpoint").notNull(),
    units: integer("units").notNull().default(0),
    quotaDate: date("quota_date").notNull(),
    statusCode: integer("status_code"),
    latencyMs: integer("latency_ms"),
    cacheHit: boolean("cache_hit").notNull().default(false),
    requestId: text("request_id"),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("api_usage_provider_date_idx").on(t.provider, t.quotaDate),
    index("api_usage_created_idx").on(t.createdAt),
  ],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    actorEmail: text("actor_email"),
    action: text("action").notNull(),
    entityType: text("entity_type"),
    entityId: text("entity_id"),
    ip: text("ip"),
    userAgent: text("user_agent"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("audit_logs_created_idx").on(t.createdAt),
    index("audit_logs_actor_idx").on(t.actorId),
    index("audit_logs_action_idx").on(t.action),
  ],
);

/* -------------------------------------------------------------------------- */
/* Relations                                                                  */
/* -------------------------------------------------------------------------- */

export const categoriesRelations = relations(categories, ({ many }) => ({
  niches: many(niches),
}));

export const nichesRelations = relations(niches, ({ one, many }) => ({
  category: one(categories, {
    fields: [niches.categoryId],
    references: [categories.id],
  }),
  parent: one(niches, {
    fields: [niches.parentId],
    references: [niches.id],
    relationName: "niche_parent",
  }),
  children: many(niches, { relationName: "niche_parent" }),
  keywords: many(nicheKeywords),
  metrics: many(nicheMetrics),
  rankings: many(nicheRankings),
}));

export const nicheKeywordsRelations = relations(nicheKeywords, ({ one }) => ({
  niche: one(niches, { fields: [nicheKeywords.nicheId], references: [niches.id] }),
}));

export const nicheMetricsRelations = relations(nicheMetrics, ({ one }) => ({
  niche: one(niches, { fields: [nicheMetrics.nicheId], references: [niches.id] }),
  source: one(dataSources, {
    fields: [nicheMetrics.sourceId],
    references: [dataSources.id],
  }),
}));

export const nicheRankingsRelations = relations(nicheRankings, ({ one }) => ({
  niche: one(niches, { fields: [nicheRankings.nicheId], references: [niches.id] }),
  version: one(rankingVersions, {
    fields: [nicheRankings.rankingVersionId],
    references: [rankingVersions.id],
  }),
  source: one(dataSources, {
    fields: [nicheRankings.sourceId],
    references: [dataSources.id],
  }),
}));

export const watchlistRelations = relations(nicheWatchlists, ({ one, many }) => ({
  user: one(users, { fields: [nicheWatchlists.userId], references: [users.id] }),
  niche: one(niches, { fields: [nicheWatchlists.nicheId], references: [niches.id] }),
  alerts: many(watchlistAlerts),
}));

export const aiReportsRelations = relations(aiReports, ({ one }) => ({
  user: one(users, { fields: [aiReports.userId], references: [users.id] }),
  niche: one(niches, { fields: [aiReports.nicheId], references: [niches.id] }),
}));

export const dataSourcesRelations = relations(dataSources, ({ many }) => ({
  permissions: many(dataPermissions),
  metrics: many(nicheMetrics),
  rankings: many(nicheRankings),
}));

export const dataPermissionsRelations = relations(dataPermissions, ({ one }) => ({
  dataSource: one(dataSources, {
    fields: [dataPermissions.dataSourceId],
    references: [dataSources.id],
  }),
}));

/* -------------------------------------------------------------------------- */
/* Inferred types                                                             */
/* -------------------------------------------------------------------------- */

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Category = typeof categories.$inferSelect;
export type Niche = typeof niches.$inferSelect;
export type NicheMetric = typeof nicheMetrics.$inferSelect;
export type NicheRanking = typeof nicheRankings.$inferSelect;
export type YouTubeChannel = typeof youtubeChannels.$inferSelect;
export type YouTubeVideo = typeof youtubeVideos.$inferSelect;
export type DataSource = typeof dataSources.$inferSelect;
export type DataPermission = typeof dataPermissions.$inferSelect;
export type AiReport = typeof aiReports.$inferSelect;
export type BackgroundJob = typeof backgroundJobs.$inferSelect;
export type ApiUsageRow = typeof apiUsage.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type WatchlistItem = typeof nicheWatchlists.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;
