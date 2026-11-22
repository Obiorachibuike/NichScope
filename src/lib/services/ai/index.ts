import { and, desc, eq, gte, sql } from "drizzle-orm";
import type { Database } from "@/lib/db/client";
import { aiReports, niches } from "@/lib/db/schema";
import { demoMode, env } from "@/lib/env";
import { getNicheBySlug } from "@/lib/services/niches";
import { auditLog } from "@/lib/services/audit";
import { createAgnesProvider, createOpenAIProvider, AIProviderError } from "./providers";
import { FixtureAIProvider } from "./fixture";
import {
  SCHEMA_BY_TYPE,
  type AIEvidence,
  type AIProvider,
  type AIResult,
  type AIReportType,
} from "./types";

export * from "./types";
export { AIProviderError } from "./providers";

export class AILimitError extends Error {
  status = 429;
  constructor(message: string) {
    super(message);
    this.name = "AILimitError";
  }
}

export class AIUnavailableError extends Error {
  status = 503;
  constructor(message: string) {
    super(message);
    this.name = "AIUnavailableError";
  }
}

export function reportTypeToMethod(type: AIReportType) {
  switch (type) {
    case "subniches":
      return "generateSubNiches" as const;
    case "video_ideas":
      return "generateVideoIdeas" as const;
    case "competition":
      return "analyzeCompetition" as const;
    case "channel_strategy":
      return "generateChannelStrategy" as const;
    case "research_report":
      return "generateResearchReport" as const;
    default:
      return "analyzeNiche" as const;
  }
}

export function getProviderChain(): { primary: AIProvider | null; fallbacks: AIProvider[] } {
  const providers: AIProvider[] = [];
  const agnes = createAgnesProvider();
  const openai = createOpenAIProvider();
  const fixture = demoMode ? new FixtureAIProvider() : null;

  if (env.AI_PROVIDER === "agnes") {
    if (agnes) providers.push(agnes);
    if (openai) providers.push(openai);
    if (fixture) providers.push(fixture);
  } else if (env.AI_PROVIDER === "openai") {
    if (openai) providers.push(openai);
    if (agnes) providers.push(agnes);
    if (fixture) providers.push(fixture);
  } else {
    if (fixture) providers.push(fixture);
  }

  if (env.AI_PROVIDER !== "fixture") {
    // In production without provider keys, do not silently fabricate a model.
    if (providers.length === 0) return { primary: null, fallbacks: [] };
  }
  const [primary, ...fallbacks] = providers;
  return { primary: primary ?? null, fallbacks };
}

export function getAIStatus() {
  const { primary, fallbacks } = getProviderChain();
  const agnes = createAgnesProvider();
  const openai = createOpenAIProvider();
  return {
    configuredProvider: env.AI_PROVIDER,
    primary: primary
      ? { key: primary.key, model: primary.model, kind: primary instanceof FixtureAIProvider ? "fixture" : "remote" }
      : null,
    fallbacks: fallbacks.map((f) => ({
      key: f.key,
      model: f.model,
      kind: f instanceof FixtureAIProvider ? "fixture" : "remote",
    })),
    providers: [
      { key: "agnes", configured: Boolean(agnes), model: env.AGNES_MODEL },
      { key: "openai", configured: Boolean(openai), model: env.OPENAI_MODEL },
      { key: "fixture", configured: demoMode, model: "nichscope-offline-fixture-v1" },
    ],
    demoMode,
  };
}

export function aiDailyLimit(plan: string): number {
  switch (plan) {
    case "pro":
      return env.AI_DAILY_LIMIT_PRO;
    case "team":
      return env.AI_DAILY_LIMIT_TEAM;
    default:
      return env.AI_DAILY_LIMIT_FREE;
  }
}

export async function getAiUsage(
  db: Database,
  userId: string,
  plan: string,
) {
  const since = new Date(Date.now() - 86_400_000);
  const [row] = await db
    .select({
      count: sql<number>`count(*)::int`,
      cost: sql<string>`coalesce(sum(${aiReports.costUsd}),0)`,
      inputTokens: sql<number>`coalesce(sum(${aiReports.inputTokens}),0)::int`,
      outputTokens: sql<number>`coalesce(sum(${aiReports.outputTokens}),0)::int`,
    })
    .from(aiReports)
    .where(and(eq(aiReports.userId, userId), gte(aiReports.createdAt, since)));

  const [global] = await db
    .select({ cost: sql<string>`coalesce(sum(${aiReports.costUsd}),0)` })
    .from(aiReports)
    .where(gte(aiReports.createdAt, since));

  const limit = aiDailyLimit(plan);
  return {
    usedToday: Number(row?.count ?? 0),
    limit,
    remaining: Math.max(0, limit - Number(row?.count ?? 0)),
    costToday: Number(row?.cost ?? 0),
    globalCostToday: Number(global?.cost ?? 0),
    inputTokens: Number(row?.inputTokens ?? 0),
    outputTokens: Number(row?.outputTokens ?? 0),
    costCapUsd: env.AI_DAILY_COST_CAP_USD,
  };
}

/** Builds evidence containing ONLY data the caller is permitted to see. */
export async function buildEvidence(
  db: Database,
  slug: string,
): Promise<{ nicheId: string; evidence: AIEvidence; nicheName: string }> {
  const detail = await getNicheBySlug(db, slug);
  if (!detail) {
    throw Object.assign(new Error("Niche not found"), { status: 404 });
  }
  const metrics = detail.metrics.find((m) => m.period === "30d") ?? detail.metrics[0];
  const notices: string[] = [];
  if (!metrics) {
    notices.push(
      "No performance metrics are attached to this niche. Do not state growth, view or competition figures.",
    );
  } else if (metrics.isFixture) {
    notices.push(
      "Attached metrics are clearly-labelled demo fixtures, not live YouTube data.",
    );
  }

  const evidence: AIEvidence = {
    niche: {
      name: detail.niche.name,
      slug: detail.niche.slug,
      category: detail.category.name,
      description: detail.niche.description,
      aliases: detail.niche.aliases,
      formats: detail.niche.formats,
      countries: detail.niche.countries,
      languages: detail.niche.primaryLanguage ? [detail.niche.primaryLanguage] : [],
      competitionLevel: detail.niche.competitionLevel,
      growthTrend: detail.niche.growthTrend,
      monetizationPotential: detail.niche.monetizationPotential,
      taxonomyKeywords: detail.keywords.map((k) => k.keyword).slice(0, 20),
    },
    metrics: metrics
      ? {
          period: metrics.period,
          viewGrowthPct: metrics.viewGrowthPct,
          channelGrowthPct: metrics.channelGrowthPct,
          avgViews: metrics.avgViews,
          engagementRate: metrics.engagementRate,
          competitionScore: metrics.competitionScore,
          opportunityScore: metrics.opportunityScore,
          sampleVideoCount: metrics.sampleVideoCount,
          sampleChannelCount: metrics.sampleChannelCount,
          confidence: metrics.confidence,
          isFixture: metrics.isFixture,
          sourceName: metrics.sourceName,
          computedAt: metrics.computedAt.toISOString(),
        }
      : null,
    subNiches: detail.children.map((child) => child.name),
    relatedNiches: detail.related.map((related) => related.name),
    rankings: detail.rankings.map((ranking) => ({
      category: ranking.category,
      period: ranking.period,
      rank: ranking.rank,
      source: ranking.sourceKey,
    })),
    dataSources: Array.from(
      new Set(["NicheScope taxonomy", ...(metrics ? [metrics.sourceName] : [])]),
    ),
    notices,
  };

  return { nicheId: detail.niche.id, evidence, nicheName: detail.niche.name };
}

export interface GenerateReportInput {
  userId: string;
  plan: string;
  nicheSlug: string;
  type: AIReportType;
  prompt?: string;
}

export async function generateReport(
  db: Database,
  input: GenerateReportInput,
) {
  const { primary, fallbacks } = getProviderChain();
  if (!primary) {
    throw new AIUnavailableError(
      "No AI provider is configured. Set AGNES_API_KEY (preferred) or OPENAI_API_KEY, or enable demo mode for the offline fixture generator.",
    );
  }

  const usage = await getAiUsage(db, input.userId, input.plan);
  if (usage.usedToday >= usage.limit) {
    throw new AILimitError(
      `Daily AI limit reached for the ${input.plan} plan (${usage.limit} reports). Upgrade your plan for more.`,
    );
  }
  if (usage.globalCostToday >= usage.costCapUsd) {
    throw new AILimitError(
      "The platform's daily AI cost cap has been reached. Please try again tomorrow.",
    );
  }

  const { nicheId, evidence, nicheName } = await buildEvidence(db, input.nicheSlug);
  const schema = SCHEMA_BY_TYPE[input.type];

  const [pending] = await db
    .insert(aiReports)
    .values({
      userId: input.userId,
      nicheId,
      type: input.type,
      title: `${labelForType(input.type)} · ${nicheName}`,
      prompt: input.prompt ?? null,
      provider: primary.key,
      model: primary.model,
      status: "pending",
      evidence: evidence as unknown as Record<string, unknown>,
    })
    .returning({ id: aiReports.id });
  const reportId = pending!.id;

  const chain = [primary, ...fallbacks];
  const method = reportTypeToMethod(input.type);
  let lastError: unknown;

  for (const provider of chain) {
    try {
      const result = (await provider[method](
        evidence,
        input.prompt ? `Creator's additional context: ${input.prompt}` : undefined,
      )) as AIResult<unknown>;

      // Defensive schema re-validation for remote providers.
      const validated = schema.safeParse(result.data);
      if (!validated.success) {
        throw new AIProviderError(
          `${provider.key} returned data that failed validation`,
          provider.key,
          false,
        );
      }

      await db
        .update(aiReports)
        .set({
          status: "completed",
          provider: provider.key,
          model: result.model,
          report: validated.data as Record<string, unknown>,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          costUsd: result.costUsd.toFixed(6),
          latencyMs: result.latencyMs,
          isFallback: provider.key !== primary.key,
          completedAt: new Date(),
        })
        .where(eq(aiReports.id, reportId));

      await auditLog(db, {
        actorId: input.userId,
        action: "ai.report.generated",
        entityType: "ai_report",
        entityId: reportId,
        metadata: {
          provider: provider.key,
          model: result.model,
          type: input.type,
          niche: input.nicheSlug,
          fixture: provider instanceof FixtureAIProvider,
          tokens: result.inputTokens + result.outputTokens,
        },
      });

      return {
        reportId,
        provider: provider.key,
        model: result.model,
        isFallback: provider.key !== primary.key,
        offlineFixture: provider instanceof FixtureAIProvider,
        content: validated.data,
        evidence,
        usage: await getAiUsage(db, input.userId, input.plan),
      };
    } catch (error) {
      lastError = error;
      console.error(`[ai] provider ${provider.key} failed`, error);
    }
  }

  const message =
    lastError instanceof Error ? lastError.message : "All AI providers failed";
  await db
    .update(aiReports)
    .set({ status: "failed", error: message, completedAt: new Date() })
    .where(eq(aiReports.id, reportId));
  throw new AIProviderError(message, primary.key, false);
}

export function labelForType(type: AIReportType): string {
  switch (type) {
    case "subniches":
      return "Sub-niche opportunities";
    case "video_ideas":
      return "Video ideas";
    case "competition":
      return "Competition analysis";
    case "channel_strategy":
      return "Channel strategy";
    case "research_report":
      return "Research report";
    default:
      return "Niche analysis";
  }
}

export async function listReports(db: Database, userId: string, limit = 20) {
  return db
    .select({
      id: aiReports.id,
      title: aiReports.title,
      type: aiReports.type,
      status: aiReports.status,
      provider: aiReports.provider,
      model: aiReports.model,
      isFallback: aiReports.isFallback,
      createdAt: aiReports.createdAt,
      completedAt: aiReports.completedAt,
      nicheName: niches.name,
      nicheSlug: niches.slug,
    })
    .from(aiReports)
    .leftJoin(niches, eq(aiReports.nicheId, niches.id))
    .where(eq(aiReports.userId, userId))
    .orderBy(desc(aiReports.createdAt))
    .limit(limit);
}

export async function getReport(db: Database, userId: string, id: string) {
  const rows = await db
    .select({
      report: aiReports,
      nicheName: niches.name,
      nicheSlug: niches.slug,
    })
    .from(aiReports)
    .leftJoin(niches, eq(aiReports.nicheId, niches.id))
    .where(and(eq(aiReports.id, id), eq(aiReports.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

/** Admin aggregate: usage across all users. */
export async function getAiUsageOverview(db: Database) {
  const since = new Date(Date.now() - 86_400_000);
  const rows = await db
    .select({
      provider: aiReports.provider,
      reports: sql<number>`count(*)::int`,
      failures: sql<number>`coalesce(sum(case when ${aiReports.status} = 'failed' then 1 else 0 end),0)::int`,
      cost: sql<string>`coalesce(sum(${aiReports.costUsd}),0)`,
      tokens: sql<number>`coalesce(sum(coalesce(${aiReports.inputTokens},0) + coalesce(${aiReports.outputTokens},0)),0)::int`,
    })
    .from(aiReports)
    .where(gte(aiReports.createdAt, since))
    .groupBy(aiReports.provider);

  const [latest] = await db
    .select({ at: aiReports.createdAt })
    .from(aiReports)
    .orderBy(desc(aiReports.createdAt))
    .limit(1);

  return {
    windowHours: 24,
    providers: rows.map((row) => ({
      provider: row.provider,
      reports: Number(row.reports),
      failures: Number(row.failures),
      costUsd: Number(row.cost),
      tokens: Number(row.tokens),
    })),
    lastReportAt: latest?.at ?? null,
    status: getAIStatus(),
  };
}
