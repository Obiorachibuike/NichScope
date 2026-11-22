import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNull,
  lte,
  ne,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { z } from "zod";
import type { Database } from "@/lib/db/client";
import {
  categories,
  dataSources,
  nicheKeywords,
  nicheMetrics,
  nicheRankings,
  niches,
  youtubeChannels,
  youtubeVideos,
} from "@/lib/db/schema";
import { demoMode } from "@/lib/env";
import { eligibleSourceKeys } from "./compliance";
import { RANKING_PERIODS, type RankingPeriod } from "./ranking";

/* -------------------------------------------------------------------------- */
/* Filters                                                                    */
/* -------------------------------------------------------------------------- */

const optionalString = z
  .string()
  .trim()
  .max(120)
  .optional()
  .transform((v) => (v && v.length > 0 ? v : undefined));

const intParam = (min: number, max: number, fallback: number) =>
  z.coerce.number().int().min(min).max(max).catch(fallback);

export const nicheFilterSchema = z.object({
  q: optionalString,
  category: optionalString,
  parent: optionalString,
  format: z.enum(["all", "shorts", "long_form"]).catch("all"),
  level: z.enum(["all", "top", "sub"]).catch("all"),
  competition: z.enum(["all", "low", "medium", "high", "unknown"]).catch("all"),
  growth: z
    .enum(["all", "fast_growing", "stable", "declining", "unknown"])
    .catch("all"),
  monetization: z.enum(["all", "low", "medium", "high", "unknown"]).catch("all"),
  country: optionalString,
  language: optionalString,
  minOpportunity: intParam(0, 100, 0),
  maxOpportunity: intParam(0, 100, 100),
  minAvgViews: z.coerce.number().int().min(0).max(1_000_000_000).catch(0),
  period: z.enum(["7d", "30d", "90d", "custom"]).catch("30d"),
  dateFrom: optionalString,
  dateTo: optionalString,
  sort: z
    .enum(["opportunity", "name", "growth", "competition", "updated", "avg_views"])
    .catch("opportunity"),
  page: intParam(1, 500, 1),
  pageSize: intParam(6, 100, 24),
});

export type NicheFilters = z.infer<typeof nicheFilterSchema>;

export function parseNicheFilters(
  input: Record<string, string | string[] | undefined>,
): NicheFilters {
  const flat: Record<string, string> = {};
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === "string") flat[key] = value;
    else if (Array.isArray(value) && value[0]) flat[key] = value[0];
  }
  return nicheFilterSchema.parse(flat);
}

export function filtersToQueryString(filters: Partial<NicheFilters>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === "") continue;
    if (key === "page" && value === 1) continue;
    params.set(key, String(value));
  }
  return params.toString();
}

/* -------------------------------------------------------------------------- */
/* Display governance                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Fixture-derived attributes must never surface outside demo mode, even if
 * demo rows still exist in the database (for example after DEMO_MODE is
 * switched off in a shared environment).
 */
export function publicNicheCondition(): SQL | undefined {
  if (demoMode) return undefined;
  return sql`coalesce(${niches.metadata}->>'fixtureMetrics', 'false') <> 'true'`;
}

export function sanitizeNicheStats<
  T extends {
    opportunityScore: string | null;
    competitionLevel: string;
    growthTrend: string;
    monetizationPotential: string;
    dataConfidence: string;
    metadata: Record<string, unknown>;
  },
>(row: T): T {
  if (demoMode) return row;
  if (row.metadata?.fixtureMetrics === true) {
    return {
      ...row,
      opportunityScore: null,
      competitionLevel: "unknown",
      growthTrend: "unknown",
      monetizationPotential: "unknown",
      dataConfidence: "unknown",
    };
  }
  return row;
}

/* -------------------------------------------------------------------------- */
/* Catalog                                                                    */
/* -------------------------------------------------------------------------- */

export async function listCategories(db: Database) {
  const rows = await db
    .select({
      id: categories.id,
      slug: categories.slug,
      name: categories.name,
      description: categories.description,
      icon: categories.icon,
      sortOrder: categories.sortOrder,
      nicheCount: sql<number>`count(${niches.id})::int`,
    })
    .from(categories)
    .leftJoin(
      niches,
      and(eq(niches.categoryId, categories.id), eq(niches.isActive, true)),
    )
    .where(eq(categories.isActive, true))
    .groupBy(categories.id)
    .orderBy(asc(categories.sortOrder), asc(categories.name));
  return rows;
}

export async function getCategoryBySlug(db: Database, slug: string) {
  const rows = await db
    .select()
    .from(categories)
    .where(eq(categories.slug, slug))
    .limit(1);
  return rows[0] ?? null;
}

export async function getEligibleMetricSourceIds(
  db: Database,
): Promise<string[]> {
  const keys = await eligibleSourceKeys(db, "public_display");
  const keysForMetrics = new Set(keys);
  keysForMetrics.add("internal_taxonomy");
  if (demoMode) keysForMetrics.add("demo_fixture");
  const rows = await db
    .select({ id: dataSources.id, key: dataSources.key, status: dataSources.status })
    .from(dataSources);
  return rows
    .filter((r) => keysForMetrics.has(r.key) && r.status !== "disabled")
    .map((r) => r.id);
}

/* -------------------------------------------------------------------------- */
/* Search + filtering                                                         */
/* -------------------------------------------------------------------------- */

export interface NicheListItem {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  categoryName: string;
  categorySlug: string;
  competitionLevel: string;
  growthTrend: string;
  monetizationPotential: string;
  opportunityScore: number | null;
  dataConfidence: string;
  isFeatured: boolean;
  formats: string[];
  countries: string[];
  primaryLanguage: string | null;
  metadata: Record<string, unknown>;
  childCount: number;
  parentName: string | null;
  parentSlug: string | null;
  avgViews: number | null;
  sourceKey: string | null;
  sourceName: string | null;
  isFixture: boolean;
  metricUpdatedAt: Date | null;
}

export interface NicheListResult {
  items: NicheListItem[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  demoData: boolean;
  statsAvailable: boolean;
}

export async function listNiches(
  db: Database,
  filters: NicheFilters,
): Promise<NicheListResult> {
  const conditions: (SQL | undefined)[] = [
    eq(niches.isActive, true),
    publicNicheCondition(),
  ];

  if (filters.q) {
    const term = `%${filters.q.replace(/[%_]/g, (m) => `\\${m}`)}%`;
    conditions.push(
      or(
        ilike(niches.name, term),
        ilike(niches.slug, term),
        ilike(niches.description, term),
        sql`${niches.aliases}::text ilike ${term}`,
        sql`${niches.keywords}::text ilike ${term}`,
        sql`exists (select 1 from ${nicheKeywords} nk where nk.niche_id = ${niches.id} and nk.keyword ilike ${term})`,
      ),
    );
  }

  if (filters.category) {
    conditions.push(eq(categories.slug, filters.category));
  }
  if (filters.parent) {
    conditions.push(
      sql`${niches.parentId} = (select p.id from ${niches} p where p.slug = ${filters.parent} limit 1)`,
    );
  }
  if (filters.level === "top") {
    conditions.push(isNull(niches.parentId));
  } else if (filters.level === "sub") {
    conditions.push(sql`${niches.parentId} is not null`);
  }

  if (filters.competition !== "all") {
    conditions.push(
      eq(
        niches.competitionLevel,
        filters.competition as "low" | "medium" | "high" | "unknown",
      ),
    );
  }
  if (filters.growth !== "all") {
    conditions.push(
      eq(niches.growthTrend, filters.growth as "fast_growing" | "stable" | "declining" | "unknown"),
    );
  }
  if (filters.monetization !== "all") {
    conditions.push(
      eq(
        niches.monetizationPotential,
        filters.monetization as "low" | "medium" | "high" | "unknown",
      ),
    );
  }
  if (filters.minOpportunity > 0) {
    conditions.push(gte(niches.opportunityScore, String(filters.minOpportunity)));
  }
  if (filters.maxOpportunity < 100) {
    conditions.push(lte(niches.opportunityScore, String(filters.maxOpportunity)));
  }
  if (filters.format !== "all") {
    conditions.push(sql`${niches.formats} ? ${filters.format}`);
  }
  if (filters.country) {
    conditions.push(sql`${niches.countries} ? ${filters.country.toUpperCase()}`);
  }
  if (filters.language) {
    conditions.push(eq(niches.primaryLanguage, filters.language));
  }

  const metricSourceIds = await getEligibleMetricSourceIds(db);
  const period = filters.period === "custom" ? "30d" : filters.period;

  // A reusable, correctly-parenthesised source filter for correlated subqueries.
  const sourceFilter =
    metricSourceIds.length > 0
      ? sql`and nm.source_id in (${sql.join(
          metricSourceIds.map((id) => sql`${id}`),
          sql`, `,
        )})`
      : sql``;

  if (filters.minAvgViews > 0 && metricSourceIds.length > 0) {
    conditions.push(
      sql`exists (select 1 from ${nicheMetrics} nm where nm.niche_id = ${niches.id} and nm.period = ${period} and nm.avg_views >= ${filters.minAvgViews} ${sourceFilter})`,
    );
  }

  if (filters.period === "custom") {
    const from = filters.dateFrom ? new Date(filters.dateFrom) : null;
    const to = filters.dateTo ? new Date(filters.dateTo) : null;
    if (from && !Number.isNaN(from.getTime())) {
      conditions.push(gte(niches.updatedAt, from));
    }
    if (to && !Number.isNaN(to.getTime())) {
      conditions.push(lte(niches.updatedAt, to));
    }
  }

  const where = and(...conditions.filter(Boolean));

  const avgViewsExpr = sql<number | null>`(
    select nm.avg_views from ${nicheMetrics} nm
    where nm.niche_id = ${niches.id} and nm.period = ${period}
    ${sourceFilter}
    order by nm.period_end desc limit 1
  )`;

  const sourceExpr = sql<string | null>`(
    select ds.key from ${nicheMetrics} nm join ${dataSources} ds on ds.id = nm.source_id
    where nm.niche_id = ${niches.id} and nm.period = ${period}
    ${sourceFilter}
    order by nm.period_end desc limit 1
  )`;

  const sourceNameExpr = sql<string | null>`(
    select ds.name from ${nicheMetrics} nm join ${dataSources} ds on ds.id = nm.source_id
    where nm.niche_id = ${niches.id} and nm.period = ${period}
    ${sourceFilter}
    order by nm.period_end desc limit 1
  )`;

  const metricUpdatedExpr = sql<Date | null>`(
    select nm.computed_at from ${nicheMetrics} nm
    where nm.niche_id = ${niches.id} and nm.period = ${period}
    ${sourceFilter}
    order by nm.period_end desc limit 1
  )`;

  const fixtureExpr = sql<boolean>`coalesce(${niches.metadata}->>'fixtureMetrics', 'false') = 'true'`;

  const growthExpr = sql<number | null>`(
    select nm.view_growth_pct from ${nicheMetrics} nm
    where nm.niche_id = ${niches.id} and nm.period = ${period}
    ${sourceFilter}
    order by nm.period_end desc limit 1
  )`;

  const competitionExpr = sql<number | null>`(
    select nm.competition_score from ${nicheMetrics} nm
    where nm.niche_id = ${niches.id} and nm.period = ${period}
    ${sourceFilter}
    order by nm.period_end desc limit 1
  )`;

  const orderBy = (() => {
    switch (filters.sort) {
      case "name":
        return asc(niches.name);
      case "growth":
        return sql`${growthExpr} desc nulls last, ${niches.name} asc`;
      case "competition":
        return sql`${competitionExpr} asc nulls last, ${niches.name} asc`;
      case "updated":
        return desc(niches.updatedAt);
      case "avg_views":
        return sql`${avgViewsExpr} desc nulls last`;
      default:
        return sql`${niches.opportunityScore} desc nulls last, ${niches.name} asc`;
    }
  })();

  const offset = (filters.page - 1) * filters.pageSize;

  const [rows, totalRow] = await Promise.all([
    db
      .select({
        id: niches.id,
        slug: niches.slug,
        name: niches.name,
        description: niches.description,
        categoryName: categories.name,
        categorySlug: categories.slug,
        competitionLevel: niches.competitionLevel,
        growthTrend: niches.growthTrend,
        monetizationPotential: niches.monetizationPotential,
        opportunityScore: niches.opportunityScore,
        dataConfidence: niches.dataConfidence,
        isFeatured: niches.isFeatured,
        formats: niches.formats,
        countries: niches.countries,
        primaryLanguage: niches.primaryLanguage,
        metadata: niches.metadata,
        childCount: sql<number>`(select count(*)::int from ${niches} child where child.parent_id = ${niches.id})`,
        parentName: sql<string | null>`(select parent.name from ${niches} parent where parent.id = ${niches.parentId})`,
        parentSlug: sql<string | null>`(select parent.slug from ${niches} parent where parent.id = ${niches.parentId})`,
        avgViews: avgViewsExpr,
        sourceKey: sourceExpr,
        sourceName: sourceNameExpr,
        metricUpdatedAt: metricUpdatedExpr,
        isFixture: fixtureExpr,
      })
      .from(niches)
      .innerJoin(categories, eq(niches.categoryId, categories.id))
      .where(where)
      .orderBy(orderBy)
      .limit(filters.pageSize)
      .offset(offset),
    db
      .select({ value: count() })
      .from(niches)
      .innerJoin(categories, eq(niches.categoryId, categories.id))
      .where(where),
  ]);

  const total = Number(totalRow[0]?.value ?? 0);
  const items = rows.map((row) => ({
    ...sanitizeNicheStats(row),
    opportunityScore:
      row.opportunityScore === null ? null : Number(row.opportunityScore),
    avgViews: row.avgViews === null ? null : Number(row.avgViews),
    isFixture: Boolean(row.isFixture),
  }));

  return {
    items,
    total,
    page: filters.page,
    pageSize: filters.pageSize,
    pageCount: Math.max(1, Math.ceil(total / filters.pageSize)),
    demoData: demoMode,
    statsAvailable: metricSourceIds.length > 0,
  };
}

/* -------------------------------------------------------------------------- */
/* Suggestions                                                                */
/* -------------------------------------------------------------------------- */

export interface Suggestion {
  type: "niche" | "keyword" | "category";
  label: string;
  slug: string;
  categorySlug?: string;
  meta?: string;
}

export async function suggestNiches(
  db: Database,
  query: string,
  limit = 8,
): Promise<Suggestion[]> {
  const term = `%${query.trim().replace(/[%_]/g, (m) => `\\${m}`)}%`;
  if (query.trim().length < 2) return [];

  const [nicheRows, keywordRows, categoryRows] = await Promise.all([
    db
      .select({
        name: niches.name,
        slug: niches.slug,
        categorySlug: categories.slug,
        categoryName: categories.name,
      })
      .from(niches)
      .innerJoin(categories, eq(niches.categoryId, categories.id))
      .where(
        and(
          eq(niches.isActive, true),
          or(
            ilike(niches.name, term),
            sql`${niches.aliases}::text ilike ${term}`,
          ),
        ),
      )
      .orderBy(asc(niches.name))
      .limit(limit),
    db
      .select({
        keyword: nicheKeywords.keyword,
        slug: niches.slug,
        name: niches.name,
      })
      .from(nicheKeywords)
      .innerJoin(niches, eq(nicheKeywords.nicheId, niches.id))
      .where(ilike(nicheKeywords.keyword, term))
      .limit(limit),
    db
      .select({ name: categories.name, slug: categories.slug })
      .from(categories)
      .where(and(eq(categories.isActive, true), ilike(categories.name, term)))
      .limit(4),
  ]);

  const seen = new Set<string>();
  const suggestions: Suggestion[] = [];
  for (const row of nicheRows) {
    if (seen.has(row.slug)) continue;
    seen.add(row.slug);
    suggestions.push({
      type: "niche",
      label: row.name,
      slug: row.slug,
      categorySlug: row.categorySlug,
      meta: row.categoryName,
    });
  }
  for (const row of keywordRows) {
    if (suggestions.length >= limit) break;
    suggestions.push({
      type: "keyword",
      label: row.keyword,
      slug: row.slug,
      meta: row.name,
    });
  }
  for (const row of categoryRows) {
    if (suggestions.length >= limit) break;
    suggestions.push({
      type: "category",
      label: row.name,
      slug: row.slug,
      meta: "Category",
    });
  }
  return suggestions.slice(0, limit);
}

/* -------------------------------------------------------------------------- */
/* Niche detail                                                               */
/* -------------------------------------------------------------------------- */

export interface NicheDetail {
  niche: typeof niches.$inferSelect;
  category: typeof categories.$inferSelect;
  parent: { id: string; slug: string; name: string } | null;
  children: { id: string; slug: string; name: string; opportunityScore: number | null }[];
  related: { id: string; slug: string; name: string; opportunityScore: number | null }[];
  keywords: { keyword: string; weight: number; source: string }[];
  metrics: {
    period: RankingPeriod;
    periodStart: Date;
    periodEnd: Date;
    avgViews: number | null;
    medianViews: number | null;
    viewGrowthPct: number | null;
    channelGrowthPct: number | null;
    videoPerformanceScore: number | null;
    competitionScore: number | null;
    engagementRate: number | null;
    consistencyScore: number | null;
    opportunityScore: number | null;
    sampleVideoCount: number;
    sampleChannelCount: number;
    confidence: string;
    isFixture: boolean;
    sourceKey: string;
    sourceName: string;
    computedAt: Date;
  }[];
  rankings: {
    category: string;
    period: string;
    rank: number;
    score: number;
    isFixture: boolean;
    sourceKey: string;
    sourceName: string;
    explanation: string | null;
  }[];
  counts: { channels: number; videos: number; subNiches: number };
  hasEligibleMetrics: boolean;
}

export async function getNicheBySlug(
  db: Database,
  slug: string,
): Promise<NicheDetail | null> {
  const rows = await db
    .select({ niche: niches, category: categories })
    .from(niches)
    .innerJoin(categories, eq(niches.categoryId, categories.id))
    .where(and(eq(niches.slug, slug), eq(niches.isActive, true)))
    .limit(1);
  if (!rows[0]) return null;
  const { niche, category } = rows[0];

  const metricSourceIds = await getEligibleMetricSourceIds(db);

  const [parentRows, childrenRows, relatedRows, keywordRows] = await Promise.all([
    niche.parentId
      ? db
          .select({ id: niches.id, slug: niches.slug, name: niches.name })
          .from(niches)
          .where(eq(niches.id, niche.parentId))
          .limit(1)
      : Promise.resolve([]),
    db
      .select({
        id: niches.id,
        slug: niches.slug,
        name: niches.name,
        opportunityScore: niches.opportunityScore,
      })
      .from(niches)
      .where(and(eq(niches.parentId, niche.id), eq(niches.isActive, true)))
      .orderBy(asc(niches.name)),
    db
      .select({
        id: niches.id,
        slug: niches.slug,
        name: niches.name,
        opportunityScore: niches.opportunityScore,
      })
      .from(niches)
      .where(
        and(
          eq(niches.categoryId, niche.categoryId),
          ne(niches.id, niche.id),
          isNull(niches.parentId),
          eq(niches.isActive, true),
        ),
      )
      .orderBy(desc(niches.opportunityScore))
      .limit(6),
    db
      .select({
        keyword: nicheKeywords.keyword,
        weight: nicheKeywords.weight,
        source: nicheKeywords.source,
      })
      .from(nicheKeywords)
      .where(eq(nicheKeywords.nicheId, niche.id))
      .orderBy(desc(nicheKeywords.weight), asc(nicheKeywords.keyword))
      .limit(40),
  ]);

  const metricRows =
    metricSourceIds.length > 0
      ? await db
          .select({
            period: nicheMetrics.period,
            periodStart: nicheMetrics.periodStart,
            periodEnd: nicheMetrics.periodEnd,
            avgViews: nicheMetrics.avgViews,
            medianViews: nicheMetrics.medianViews,
            viewGrowthPct: nicheMetrics.viewGrowthPct,
            channelGrowthPct: nicheMetrics.channelGrowthPct,
            videoPerformanceScore: nicheMetrics.videoPerformanceScore,
            competitionScore: nicheMetrics.competitionScore,
            engagementRate: nicheMetrics.engagementRate,
            consistencyScore: nicheMetrics.consistencyScore,
            opportunityScore: nicheMetrics.opportunityScore,
            sampleVideoCount: nicheMetrics.sampleVideoCount,
            sampleChannelCount: nicheMetrics.sampleChannelCount,
            confidence: nicheMetrics.confidence,
            isFixture: nicheMetrics.isFixture,
            sourceKey: dataSources.key,
            sourceName: dataSources.name,
            computedAt: nicheMetrics.computedAt,
          })
          .from(nicheMetrics)
          .innerJoin(dataSources, eq(nicheMetrics.sourceId, dataSources.id))
          .where(
            and(
              eq(nicheMetrics.nicheId, niche.id),
              inArray(nicheMetrics.sourceId, metricSourceIds),
              demoMode ? undefined : eq(nicheMetrics.isFixture, false),
            ),
          )
          .orderBy(desc(nicheMetrics.periodEnd))
      : [];

  // Latest row per period (prefer licensed over fixture when both exist).
  const metricsByPeriod = new Map<string, (typeof metricRows)[number]>();
  for (const row of metricRows) {
    const existing = metricsByPeriod.get(row.period);
    if (!existing) {
      metricsByPeriod.set(row.period, row);
      continue;
    }
    if (existing.isFixture && !row.isFixture) {
      metricsByPeriod.set(row.period, row);
    }
  }

  const rankings =
    metricSourceIds.length > 0
      ? (
          await db
            .select({
              category: nicheRankings.category,
              period: nicheRankings.period,
              rank: nicheRankings.rank,
              score: nicheRankings.score,
              isFixture: nicheRankings.isFixture,
              sourceKey: dataSources.key,
              sourceName: dataSources.name,
              explanation: nicheRankings.explanation,
            })
            .from(nicheRankings)
            .innerJoin(dataSources, eq(nicheRankings.sourceId, dataSources.id))
            .where(
              and(
                eq(nicheRankings.nicheId, niche.id),
                eq(nicheRankings.isPublished, true),
                inArray(nicheRankings.sourceId, metricSourceIds),
                demoMode ? undefined : eq(nicheRankings.isFixture, false),
              ),
            )
            .orderBy(desc(nicheRankings.computedAt))
        ).filter(
          (row, index, all) =>
            all.findIndex(
              (r) => r.category === row.category && r.period === row.period,
            ) === index,
        )
      : [];

  const [channelCount, videoCount] = await Promise.all([
    db
      .select({ value: count() })
      .from(youtubeChannels)
      .where(
        and(
          eq(youtubeChannels.nicheId, niche.id),
          demoMode ? undefined : eq(youtubeChannels.isFixture, false),
        ),
      ),
    db
      .select({ value: count() })
      .from(youtubeVideos)
      .where(
        and(
          eq(youtubeVideos.nicheId, niche.id),
          demoMode ? undefined : eq(youtubeVideos.isFixture, false),
        ),
      ),
  ]);

  const parse = (value: string | null) => (value === null ? null : Number(value));

  return {
    niche: sanitizeNicheStats(niche),
    category,
    parent: parentRows[0] ?? null,
    children: childrenRows.map((child) => ({
      ...child,
      opportunityScore: parse(child.opportunityScore),
    })),
    related: relatedRows.map((r) => ({
      ...r,
      opportunityScore: parse(r.opportunityScore),
    })),
    keywords: keywordRows.map((k) => ({ ...k, weight: Number(k.weight) })),
    metrics: [...metricsByPeriod.values()]
      .sort((a, b) =>
        RANKING_PERIODS.indexOf(a.period as RankingPeriod) -
        RANKING_PERIODS.indexOf(b.period as RankingPeriod),
      )
      .map((row) => ({
        ...row,
        avgViews: parse(row.avgViews),
        medianViews: parse(row.medianViews),
        viewGrowthPct: parse(row.viewGrowthPct),
        channelGrowthPct: parse(row.channelGrowthPct),
        videoPerformanceScore: parse(row.videoPerformanceScore),
        competitionScore: parse(row.competitionScore),
        engagementRate: parse(row.engagementRate),
        consistencyScore: parse(row.consistencyScore),
        opportunityScore: parse(row.opportunityScore),
        period: row.period as RankingPeriod,
      })),
    rankings: rankings.map((r) => ({ ...r, score: Number(r.score) })),
    counts: {
      channels: Number(channelCount[0]?.value ?? 0),
      videos: Number(videoCount[0]?.value ?? 0),
      subNiches: childrenRows.length,
    },
    hasEligibleMetrics: metricSourceIds.length > 0,
  };
}

export async function getRelatedNichesByCategory(
  db: Database,
  categoryId: string,
  excludeId: string,
  limit = 6,
) {
  const rows = await db
    .select({
      id: niches.id,
      slug: niches.slug,
      name: niches.name,
      opportunityScore: niches.opportunityScore,
    })
    .from(niches)
    .where(
      and(
        eq(niches.categoryId, categoryId),
        ne(niches.id, excludeId),
        eq(niches.isActive, true),
      ),
    )
    .orderBy(desc(niches.opportunityScore))
    .limit(limit);
  return rows.map((r) => ({
    ...r,
    opportunityScore: r.opportunityScore === null ? null : Number(r.opportunityScore),
  }));
}

export async function listSubNiches(
  db: Database,
  parentSlug: string,
): Promise<{ parent: NicheDetail | null; children: NicheListItem[] }> {
  const parent = await getNicheBySlug(db, parentSlug);
  if (!parent) return { parent: null, children: [] };
  const result = await listNiches(db, {
    ...nicheFilterSchema.parse({}),
    parent: parentSlug,
    pageSize: 100,
  });
  return { parent, children: result.items };
}
