import { z } from "zod";

/* -------------------------------------------------------------------------- */
/* Structured AI output schemas                                               */
/* -------------------------------------------------------------------------- */

const stringList = z.array(z.string().min(1)).max(20);

export const nicheAnalysisSchema = z.object({
  overview: z.string().min(20),
  targetAudience: z
    .array(
      z.object({
        segment: z.string(),
        description: z.string(),
        motivation: z.string().optional(),
      }),
    )
    .min(1)
    .max(8),
  audienceProblems: stringList,
  subNiches: z
    .array(
      z.object({
        name: z.string(),
        rationale: z.string(),
        recommendedFormat: z.string().optional(),
      }),
    )
    .max(12),
  competitionObservations: stringList,
  facelessSuitability: z.object({
    score: z.number().min(0).max(100),
    rationale: z.string(),
    formats: stringList.optional(),
  }),
  contentFormats: z.array(
    z.object({ format: z.string(), description: z.string(), cadence: z.string().optional() }),
  ),
  positioning: z.string(),
  differentiation: stringList,
  videoTopics: z
    .array(z.object({ title: z.string(), angle: z.string(), format: z.string().optional() }))
    .max(20),
  risks: stringList,
  nextSteps: stringList,
  evidenceClassification: z.object({
    verified: stringList,
    estimated: stringList,
    aiRecommendations: stringList,
  }),
});

export type NicheAnalysis = z.infer<typeof nicheAnalysisSchema>;

export const subNicheSchema = z.object({
  subNiches: z
    .array(
      z.object({
        name: z.string(),
        rationale: z.string(),
        audience: z.string().optional(),
        recommendedFormat: z.string().optional(),
        difficulty: z.enum(["low", "medium", "high"]).optional(),
      }),
    )
    .min(1)
    .max(20),
  notes: stringList,
});

export type SubNicheSuggestions = z.infer<typeof subNicheSchema>;

export const videoIdeasSchema = z.object({
  ideas: z
    .array(
      z.object({
        title: z.string(),
        hook: z.string(),
        format: z.enum(["short", "long_form"]),
        rationale: z.string(),
        difficulty: z.enum(["low", "medium", "high"]).optional(),
      }),
    )
    .min(1)
    .max(30),
  notes: stringList,
});

export type VideoIdeas = z.infer<typeof videoIdeasSchema>;

export const competitionSchema = z.object({
  observations: stringList,
  differentiation: stringList,
  risks: stringList,
  opportunities: stringList,
  evidenceClassification: z.object({
    verified: stringList,
    estimated: stringList,
    aiRecommendations: stringList,
  }),
});

export type CompetitionAnalysis = z.infer<typeof competitionSchema>;

export const channelStrategySchema = z.object({
  positioning: z.string(),
  audiencePromise: z.string(),
  seriesIdeas: z.array(z.object({ name: z.string(), description: z.string() })),
  cadence: z.string(),
  monetization: stringList,
  firstNinetyDays: stringList,
  differentiation: stringList,
  risks: stringList,
});

export type ChannelStrategy = z.infer<typeof channelStrategySchema>;

export type AIReportType =
  | "niche_analysis"
  | "subniches"
  | "video_ideas"
  | "competition"
  | "channel_strategy"
  | "research_report";

export type AISchemaByType = {
  niche_analysis: NicheAnalysis;
  research_report: NicheAnalysis;
  subniches: SubNicheSuggestions;
  video_ideas: VideoIdeas;
  competition: CompetitionAnalysis;
  channel_strategy: ChannelStrategy;
};

export type AIResult<T> = {
  data: T;
  raw: string | null;
  model: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  latencyMs: number;
};

export interface AIEvidence {
  niche: {
    name: string;
    slug: string;
    category: string;
    description: string | null;
    aliases: string[];
    formats: string[];
    countries: string[];
    languages: string[];
    competitionLevel: string;
    growthTrend: string;
    monetizationPotential: string;
    taxonomyKeywords: string[];
  };
  metrics: {
    period: string;
    viewGrowthPct: number | null;
    channelGrowthPct: number | null;
    avgViews: number | null;
    engagementRate: number | null;
    competitionScore: number | null;
    opportunityScore: number | null;
    sampleVideoCount: number;
    sampleChannelCount: number;
    confidence: string;
    isFixture: boolean;
    sourceName: string;
    computedAt: string;
  } | null;
  subNiches: string[];
  relatedNiches: string[];
  rankings: { category: string; period: string; rank: number; source: string }[];
  dataSources: string[];
  notices: string[];
}

export interface AIProvider {
  key: string;
  model: string;
  analyzeNiche(evidence: AIEvidence, prompt?: string): Promise<AIResult<NicheAnalysis>>;
  generateSubNiches(
    evidence: AIEvidence,
    prompt?: string,
  ): Promise<AIResult<SubNicheSuggestions>>;
  generateVideoIdeas(evidence: AIEvidence, prompt?: string): Promise<AIResult<VideoIdeas>>;
  analyzeCompetition(
    evidence: AIEvidence,
    prompt?: string,
  ): Promise<AIResult<CompetitionAnalysis>>;
  generateChannelStrategy(
    evidence: AIEvidence,
    prompt?: string,
  ): Promise<AIResult<ChannelStrategy>>;
  generateResearchReport(
    evidence: AIEvidence,
    prompt?: string,
  ): Promise<AIResult<NicheAnalysis>>;
}

export const SCHEMA_BY_TYPE = {
  niche_analysis: nicheAnalysisSchema,
  research_report: nicheAnalysisSchema,
  subniches: subNicheSchema,
  video_ideas: videoIdeasSchema,
  competition: competitionSchema,
  channel_strategy: channelStrategySchema,
} as const;

/** System prompt shared by every provider. */
export const SYSTEM_PROMPT = `You are NicheScope's YouTube niche analyst.

Hard rules:
1. NEVER invent or change statistics. Use only numeric facts present in the supplied evidence. If no metrics are supplied, explicitly say that performance data is unavailable.
2. Clearly separate verified facts (taxonomy/data source facts), estimates (metrics labelled estimated), and your own recommendations.
3. Do not claim YouTube endorsement, and do not present speculation about individual creators as fact.
4. Do not make geographical popularity claims unless the evidence includes region data.
5. Be concrete and useful: suggest content formats, audience problems and testable video ideas.
6. Return ONLY valid JSON matching the requested schema. No markdown, no commentary.

Every claim you classify as "verified" must be traceable to the evidence object.`;

export function buildUserPrompt(
  evidence: AIEvidence,
  task: string,
  extra?: string,
): string {
  return `${task}

EVIDENCE (the only permitted source of facts):
${JSON.stringify(evidence, null, 2)}
${extra ? `\nADDITIONAL CONTEXT:\n${extra}\n` : ""}
Respond with JSON only.`;
}
