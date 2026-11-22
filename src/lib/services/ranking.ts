import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type { Database } from "@/lib/db/client";
import {
  categories,
  dataSources,
  nicheMetrics,
  nicheRankings,
  niches,
  rankingVersions,
} from "@/lib/db/schema";
import { demoMode } from "@/lib/env";
import { clamp, round } from "@/lib/utils";
import { eligibleSourceKeys } from "./compliance";

/**
 * Opportunity scoring + ranking engine.
 *
 * The engine is deliberately independent from the data providers: it only
 * accepts metrics rows whose source is currently eligible for ranking (checked
 * through the compliance service). Every published ranking carries the source,
 * scoring version, weights, measurement window and an explanation.
 */

export const SCORING_VERSION = "opportunity-v1";
export const RANKING_VERSION = "2026.01";

export interface ScoringWeights {
  recentGrowth: number;
  channelGrowth: number;
  videoPerformance: number;
  competitionOpportunity: number;
  engagement: number;
  contentConsistency: number;
}

export const DEFAULT_WEIGHTS: ScoringWeights = {
  recentGrowth: 25,
  channelGrowth: 20,
  videoPerformance: 20,
  competitionOpportunity: 20,
  engagement: 10,
  contentConsistency: 5,
};

export interface ScoringInputs {
  viewGrowthPct: number;
  channelGrowthPct: number;
  videoPerformanceScore: number;
  competitionScore: number;
  engagementRate: number;
  consistencyScore: number;
}

export interface ScoreBreakdown {
  score: number;
  components: Record<keyof ScoringWeights, number>;
  normalised: Record<keyof ScoringWeights, number>;
}

/** Growth percentage (-50%..150%) → 0..100. */
export function normaliseGrowth(pct: number): number {
  return clamp(((pct + 50) / 200) * 100);
}

/** Channel growth percentage (-20%..80%) → 0..100. */
export function normaliseChannelGrowth(pct: number): number {
  return clamp(((pct + 20) / 100) * 100);
}

/** Engagement rate 0..12% → 0..100. */
export function normaliseEngagement(rate: number): number {
  return clamp((rate / 12) * 100);
}

/**
 * Opportunity score. Higher competition *reduces* the opportunity component
 * (inverted competition score), and the weights must sum to 100.
 */
export function computeOpportunityScore(
  input: ScoringInputs,
  weights: ScoringWeights = DEFAULT_WEIGHTS,
): ScoreBreakdown {
  const normalised: Record<keyof ScoringWeights, number> = {
    recentGrowth: normaliseGrowth(input.viewGrowthPct),
    channelGrowth: normaliseChannelGrowth(input.channelGrowthPct),
    videoPerformance: clamp(input.videoPerformanceScore),
    competitionOpportunity: clamp(100 - input.competitionScore),
    engagement: normaliseEngagement(input.engagementRate),
    contentConsistency: clamp(input.consistencyScore),
  };

  const totalWeight = Object.values(weights).reduce((sum, w) => sum + w, 0);
  const components = {} as Record<keyof ScoringWeights, number>;
  let score = 0;
  for (const key of Object.keys(weights) as (keyof ScoringWeights)[]) {
    const contribution = (normalised[key] * weights[key]) / totalWeight;
    components[key] = round(contribution, 2);
    score += contribution;
  }
  return { score: round(clamp(score), 2), components, normalised };
}

export function explainScore(
  input: ScoringInputs,
  breakdown: ScoreBreakdown,
  weights: ScoringWeights = DEFAULT_WEIGHTS,
): string {
  const labels: Record<keyof ScoringWeights, string> = {
    recentGrowth: `recent view growth ${input.viewGrowthPct.toFixed(1)}%`,
    channelGrowth: `channel growth ${input.channelGrowthPct.toFixed(1)}%`,
    videoPerformance: `video performance ${input.videoPerformanceScore.toFixed(0)}/100`,
    competitionOpportunity: `competition ${input.competitionScore.toFixed(0)}/100`,
    engagement: `engagement ${input.engagementRate.toFixed(1)}%`,
    contentConsistency: `consistency ${input.consistencyScore.toFixed(0)}/100`,
  };
  const parts = (Object.keys(weights) as (keyof ScoringWeights)[])
    .map((key) => `${labels[key]} → ${breakdown.components[key].toFixed(1)} pts`)
    .join("; ");
  return `Opportunity score ${breakdown.score}/100 (${SCORING_VERSION}, weights ${JSON.stringify(
    weights,
  )}). ${parts}.`;
}

export type RankingCategory =
  | "top_performing"
  | "highest_growth"
  | "opportunity"
  | "low_competition"
  | "emerging"
  | "declining";

export type RankingPeriod = "7d" | "30d" | "90d";

export const RANKING_CATEGORIES: RankingCategory[] = [
  "top_performing",
  "highest_growth",
  "opportunity",
  "low_competition",
  "emerging",
  "declining",
];

export const RANKING_PERIODS: RankingPeriod[] = ["7d", "30d", "90d"];

interface MetricRow {
  nicheId: string;
  sourceId: string;
  sourceKey: string;
  isFixture: boolean;
  avgViews: string | null;
  viewGrowthPct: string | null;
  channelGrowthPct: string | null;
  videoPerformanceScore: string | null;
  competitionScore: string | null;
  engagementRate: string | null;
  consistencyScore: string | null;
  opportunityScore: string | null;
  sampleVideoCount: number;
  sampleChannelCount: number;
  confidence: string;
  periodStart: Date;
  periodEnd: Date;
  computedAt: Date;
}

function numeric(value: string | null, fallback = 0): number {
  if (value === null) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function scoreForCategory(
  category: RankingCategory,
  metric: {
    opportunity: number;
    growth: number;
    competition: number;
    performance: number;
  },
): number {
  switch (category) {
    case "top_performing":
      return round(metric.opportunity * 0.5 + metric.performance * 0.5, 2);
    case "highest_growth":
      return round(metric.growth, 2);
    case "opportunity":
      return round(metric.opportunity, 2);
    case "low_competition":
      return round((100 - metric.competition) * 0.7 + metric.opportunity * 0.3, 2);
    case "emerging":
      return round(metric.growth * 0.6 + metric.opportunity * 0.4, 2);
    case "declining":
      return round(metric.growth, 2);
  }
}

export function qualifiesForCategory(
  category: RankingCategory,
  metric: { growth: number; competition: number; sampleVideoCount: number },
): boolean {
  switch (category) {
    case "emerging":
      return metric.growth >= 40 && metric.competition <= 60;
    case "declining":
      return metric.growth < -2;
    case "low_competition":
      return metric.competition < 55;
    default:
      return true;
  }
}

export async function ensureRankingVersion(
  db: Database,
  weights: ScoringWeights = DEFAULT_WEIGHTS,
): Promise<{ id: string; version: string }> {
  const existing = await db
    .select()
    .from(rankingVersions)
    .where(eq(rankingVersions.version, RANKING_VERSION))
    .limit(1);
  if (existing[0]) return { id: existing[0].id, version: existing[0].version };

  const inserted = await db
    .insert(rankingVersions)
    .values({
      version: RANKING_VERSION,
      scoringVersion: SCORING_VERSION,
      description:
        "Baseline opportunity model: growth-weighted with competition inversion and engagement/consistency signals.",
      weights: weights as unknown as Record<string, number>,
      isActive: true,
    })
    .onConflictDoNothing({ target: rankingVersions.version })
    .returning({ id: rankingVersions.id, version: rankingVersions.version });
  if (inserted[0]) return inserted[0];

  const again = await db
    .select({ id: rankingVersions.id, version: rankingVersions.version })
    .from(rankingVersions)
    .where(eq(rankingVersions.version, RANKING_VERSION))
    .limit(1);
  return again[0]!;
}

export interface GenerationResult {
  generated: number;
  sourcesUsed: string[];
  skippedSources: { key: string; reason: string }[];
  categories: Record<string, number>;
}

/**
 * Calculates and persists rankings for a period from every eligible source.
 * Idempotent: reruns upsert the same ranking rows.
 */
export async function generateRankings(
  db: Database,
  options: { period: RankingPeriod; now?: Date } = { period: "30d" },
): Promise<GenerationResult> {
  const now = options.now ?? new Date();
  const eligible = await eligibleSourceKeys(db, "ranking");
  const version = await ensureRankingVersion(db);

  const sourceRows = await db.select().from(dataSources);
  const eligibleIds = sourceRows
    .filter((s) => eligible.has(s.key))
    .map((s) => s.id);

  const result: GenerationResult = {
    generated: 0,
    sourcesUsed: [],
    skippedSources: sourceRows
      .filter((s) => !eligible.has(s.key) && s.type !== "internal_taxonomy" && s.type !== "ai")
      .map((s) => ({
        key: s.key,
        reason: "Source not eligible for ranking without approved permissions.",
      })),
    categories: {},
  };

  if (eligibleIds.length === 0) return result;

  const rows = (await db
    .select({
      nicheId: nicheMetrics.nicheId,
      sourceId: nicheMetrics.sourceId,
      sourceKey: dataSources.key,
      isFixture: nicheMetrics.isFixture,
      avgViews: nicheMetrics.avgViews,
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
      periodStart: nicheMetrics.periodStart,
      periodEnd: nicheMetrics.periodEnd,
      computedAt: nicheMetrics.computedAt,
    })
    .from(nicheMetrics)
    .innerJoin(dataSources, eq(nicheMetrics.sourceId, dataSources.id))
    .where(
      and(
        eq(nicheMetrics.period, options.period),
        inArray(nicheMetrics.sourceId, eligibleIds),
      ),
    )) as MetricRow[];

  // Only the most recent metric per niche/source participates.
  const latest = new Map<string, MetricRow>();
  for (const row of rows) {
    const key = `${row.nicheId}:${row.sourceId}`;
    const current = latest.get(key);
    if (!current || row.periodEnd.getTime() > current.periodEnd.getTime()) {
      latest.set(key, row);
    }
  }

  const bySource = new Map<string, MetricRow[]>();
  for (const row of latest.values()) {
    const list = bySource.get(row.sourceId) ?? [];
    list.push(row);
    bySource.set(row.sourceId, list);
  }

  for (const [sourceId, metrics] of bySource) {
    const sourceKey = metrics[0]!.sourceKey;
    result.sourcesUsed.push(sourceKey);

    for (const category of RANKING_CATEGORIES) {
      const scored = metrics
        .map((metric) => {
          const growth = numeric(metric.viewGrowthPct);
          const competition = numeric(metric.competitionScore, 50);
          const performance = numeric(metric.videoPerformanceScore, 50);
          const opportunity = numeric(metric.opportunityScore);
          return {
            metric,
            growth,
            competition,
            performance,
            opportunity,
            score: scoreForCategory(category, {
              growth,
              opportunity,
              competition,
              performance,
            }),
          };
        })
        .filter((row) =>
          qualifiesForCategory(category, {
            growth: row.growth,
            competition: row.competition,
            sampleVideoCount: row.metric.sampleVideoCount,
          }),
        )
        .sort((a, b) =>
          category === "declining" ? a.score - b.score : b.score - a.score,
        );

      if (scored.length === 0) continue;

      const periodStart = new Date(
        Math.min(...scored.map((s) => s.metric.periodStart.getTime())),
      );
      const periodEnd = new Date(
        Math.max(...scored.map((s) => s.metric.periodEnd.getTime())),
      );

      let rank = 1;
      for (const row of scored) {
        const { metric } = row;
        const inputs: ScoringInputs = {
          viewGrowthPct: row.growth,
          channelGrowthPct: numeric(metric.channelGrowthPct),
          videoPerformanceScore: row.performance,
          competitionScore: row.competition,
          engagementRate: numeric(metric.engagementRate),
          consistencyScore: numeric(metric.consistencyScore),
        };
        const breakdown = computeOpportunityScore(inputs);
        const explanation = explainScore(inputs, breakdown);

        await db
          .insert(nicheRankings)
          .values({
            nicheId: metric.nicheId,
            rankingVersionId: version.id,
            sourceId,
            category,
            period: options.period,
            periodStart,
            periodEnd,
            rank,
            score: row.score.toFixed(2),
            metrics: {
              avgViews: numeric(metric.avgViews),
              viewGrowthPct: row.growth,
              channelGrowthPct: inputs.channelGrowthPct,
              videoPerformanceScore: row.performance,
              competitionScore: row.competition,
              engagementRate: inputs.engagementRate,
              consistencyScore: inputs.consistencyScore,
              opportunityScore: row.opportunity,
              sampleVideoCount: metric.sampleVideoCount,
              sampleChannelCount: metric.sampleChannelCount,
            },
            explanation,
            provenance: {
              sourceKey,
              sourceType: "metrics",
              scoringVersion: SCORING_VERSION,
              rankingVersion: version.version,
              weights: DEFAULT_WEIGHTS,
              inputFields: Object.keys(DEFAULT_WEIGHTS),
              confidence: metric.confidence,
              isFixture: metric.isFixture,
              calculatedAt: now.toISOString(),
            },
            isFixture: metric.isFixture,
            isPublished: true,
            computedAt: now,
          })
          .onConflictDoUpdate({
            target: [
              nicheRankings.nicheId,
              nicheRankings.sourceId,
              nicheRankings.category,
              nicheRankings.period,
              nicheRankings.periodStart,
              nicheRankings.rankingVersionId,
            ],
            set: {
              rank,
              score: row.score.toFixed(2),
              metrics: sql`excluded.metrics`,
              explanation: sql`excluded.explanation`,
              provenance: sql`excluded.provenance`,
              isFixture: metric.isFixture,
              computedAt: now,
            },
          });
        rank += 1;
        result.generated += 1;
      }
      result.categories[category] = scored.length;
    }
  }

  return result;
}

export interface RankingListItem {
  nicheId: string;
  slug: string;
  name: string;
  categoryName: string;
  categorySlug: string;
  rank: number;
  score: number;
  metrics: Record<string, unknown>;
  explanation: string | null;
  sourceKey: string;
  sourceName: string;
  isFixture: boolean;
  periodStart: Date;
  periodEnd: Date;
  computedAt: Date;
}

export async function listRankings(
  db: Database,
  options: {
    category: RankingCategory;
    period: RankingPeriod;
    limit?: number;
    sourceKey?: string;
  },
): Promise<RankingListItem[]> {
  const eligible = await eligibleSourceKeys(db, "ranking");
  if (eligible.size === 0) return [];

  const latest = await db
    .select({ periodEnd: sql<Date>`max(${nicheRankings.periodEnd})` })
    .from(nicheRankings)
    .where(
      and(
        eq(nicheRankings.category, options.category),
        eq(nicheRankings.period, options.period),
        eq(nicheRankings.isPublished, true),
      ),
    );
  const latestEnd = latest[0]?.periodEnd ? new Date(latest[0].periodEnd) : null;
  if (!latestEnd) return [];

  const sourceRows = await db.select().from(dataSources);
  const allowedIds = sourceRows
    .filter(
      (s) =>
        eligible.has(s.key) &&
        (!options.sourceKey || s.key === options.sourceKey) &&
        (demoMode || s.type !== "demo_fixture"),
    )
    .map((s) => s.id);
  if (allowedIds.length === 0) return [];

  const rows = await db
    .select({
      nicheId: nicheRankings.nicheId,
      slug: niches.slug,
      name: niches.name,
      categoryName: categories.name,
      categorySlug: categories.slug,
      rank: nicheRankings.rank,
      score: nicheRankings.score,
      metrics: nicheRankings.metrics,
      explanation: nicheRankings.explanation,
      sourceKey: dataSources.key,
      sourceName: dataSources.name,
      isFixture: nicheRankings.isFixture,
      periodStart: nicheRankings.periodStart,
      periodEnd: nicheRankings.periodEnd,
      computedAt: nicheRankings.computedAt,
    })
    .from(nicheRankings)
    .innerJoin(niches, eq(nicheRankings.nicheId, niches.id))
    .innerJoin(categories, eq(niches.categoryId, categories.id))
    .innerJoin(dataSources, eq(nicheRankings.sourceId, dataSources.id))
    .where(
      and(
        eq(nicheRankings.category, options.category),
        eq(nicheRankings.period, options.period),
        eq(nicheRankings.periodEnd, latestEnd),
        eq(nicheRankings.isPublished, true),
        inArray(nicheRankings.sourceId, allowedIds),
      ),
    )
    .orderBy(nicheRankings.rank)
    .limit(Math.min(options.limit ?? 10, 100));

  return rows.map((row) => ({
    ...row,
    score: Number(row.score),
  }));
}

/** Ranking position + score for a single niche across categories. */
export async function getNicheRankingSummary(
  db: Database,
  nicheId: string,
): Promise<
  { category: RankingCategory; period: RankingPeriod; rank: number; score: number }[]
> {
  const eligible = await eligibleSourceKeys(db, "ranking");
  const rows = await db
    .select({
      category: nicheRankings.category,
      period: nicheRankings.period,
      rank: nicheRankings.rank,
      score: nicheRankings.score,
      sourceKey: dataSources.key,
      isFixture: nicheRankings.isFixture,
    })
    .from(nicheRankings)
    .innerJoin(dataSources, eq(nicheRankings.sourceId, dataSources.id))
    .where(eq(nicheRankings.nicheId, nicheId))
    .orderBy(desc(nicheRankings.computedAt));

  const seen = new Set<string>();
  const output: {
    category: RankingCategory;
    period: RankingPeriod;
    rank: number;
    score: number;
  }[] = [];
  for (const row of rows) {
    if (!eligible.has(row.sourceKey)) continue;
    if (row.isFixture && !demoMode) continue;
    const key = `${row.category}:${row.period}`;
    if (seen.has(key)) continue;
    seen.add(key);
    output.push({
      category: row.category as RankingCategory,
      period: row.period as RankingPeriod,
      rank: row.rank,
      score: Number(row.score),
    });
  }
  return output;
}
