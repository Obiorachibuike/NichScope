import { z } from "zod";
import { env } from "@/lib/env";
import {
  SYSTEM_PROMPT,
  buildUserPrompt,
  competitionSchema,
  nicheAnalysisSchema,
  subNicheSchema,
  videoIdeasSchema,
  channelStrategySchema,
  type AIEvidence,
  type AIProvider,
  type AIResult,
} from "./types";

export class AIProviderError extends Error {
  constructor(
    message: string,
    public readonly provider: string,
    public readonly retryable: boolean,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "AIProviderError";
  }
}

export const TASK_PROMPTS = {
  niche_analysis: `Analyse the niche for a YouTube creator. Cover: overview, target audience, audience problems, sub-niche opportunities, competition observations, faceless suitability, content formats, positioning, differentiation, video topics, risks and next steps.`,
  research_report: `Produce a complete niche research report for a creator deciding whether to enter this niche. Cover: overview, target audience, audience problems, sub-niche opportunities, competition observations, faceless suitability, content formats, positioning, differentiation, video topics, risks and next steps.`,
  subniches: `Propose specific sub-niches a creator could enter. Each must be narrow enough to build a channel around, with a rationale and recommended format.`,
  video_ideas: `Generate testable video ideas with hooks and recommended format (short or long_form), grounded in the audience problems and niche evidence.`,
  competition: `Summarise competition observations, differentiation angles, opportunities and risks using only the supplied evidence. Do not assert facts about specific channels not present in the evidence.`,
  channel_strategy: `Design a channel strategy: positioning, audience promise, series ideas, cadence, monetization and a realistic first 90 days.`,
} as const;

export type TaskType = keyof typeof TASK_PROMPTS;

const PRICING: Record<string, { input: number; output: number }> = {
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "gpt-4.1-mini": { input: 0.4, output: 1.6 },
  "agnes-1": { input: 0, output: 0 },
};

export function estimateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const price = PRICING[model] ?? { input: 0, output: 0 };
  return (
    (inputTokens / 1_000_000) * price.input +
    (outputTokens / 1_000_000) * price.output
  );
}

/** Extracts a JSON object from a model response that may include fences. */
export function extractJson(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced?.[1]?.trim() ?? trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("AI response did not contain a JSON object");
  }
  return candidate.slice(start, end + 1);
}

interface ChatResponse {
  choices?: { message?: { content?: string } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

export interface ProviderOptions {
  key: string;
  name: string;
  baseUrl: string;
  model: string;
  apiKey: string;
}

/**
 * OpenAI-compatible chat completions adapter. Agnes AI exposes an
 * OpenAI-compatible endpoint, so the same transport serves both providers.
 */
export class OpenAICompatibleProvider implements AIProvider {
  readonly key: string;
  readonly model: string;
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly providerName: string;

  constructor(options: ProviderOptions) {
    this.key = options.key;
    this.model = options.model;
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.apiKey = options.apiKey;
    this.providerName = options.name;
  }

  private async run<T extends z.ZodTypeAny>(
    schema: T,
    task: TaskType,
    evidence: AIEvidence,
    extra?: string,
    maxTokens = 2_400,
  ): Promise<AIResult<z.infer<T>>> {
    const started = Date.now();
    let lastError: unknown;

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const response = await fetch(`${this.baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            model: this.model,
            temperature: 0.6,
            max_tokens: maxTokens,
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              {
                role: "user",
                content: buildUserPrompt(evidence, TASK_PROMPTS[task], extra),
              },
            ],
          }),
          signal: AbortSignal.timeout(60_000),
        });

        if (!response.ok) {
          const body = await response.text();
          const retryable = response.status === 429 || response.status >= 500;
          throw new AIProviderError(
            `${this.providerName} request failed (${response.status}): ${body.slice(0, 300)}`,
            this.key,
            retryable,
            response.status,
          );
        }

        const json = (await response.json()) as ChatResponse;
        const content = json.choices?.[0]?.message?.content;
        if (!content) {
          throw new AIProviderError(
            `${this.providerName} returned an empty response`,
            this.key,
            true,
          );
        }

        let parsed: unknown;
        try {
          parsed = JSON.parse(extractJson(content));
        } catch (error) {
          throw new AIProviderError(
            `${this.providerName} returned invalid JSON: ${
              error instanceof Error ? error.message : "unknown"
            }`,
            this.key,
            true,
          );
        }

        const validated = schema.safeParse(parsed);
        if (!validated.success) {
          throw new AIProviderError(
            `${this.providerName} response failed schema validation: ${validated.error.issues
              .slice(0, 3)
              .map((i) => `${i.path.join(".")}: ${i.message}`)
              .join("; ")}`,
            this.key,
            true,
          );
        }

        const inputTokens = json.usage?.prompt_tokens ?? 0;
        const outputTokens = json.usage?.completion_tokens ?? 0;
        return {
          data: validated.data as z.infer<T>,
          raw: content,
          model: this.model,
          provider: this.key,
          inputTokens,
          outputTokens,
          costUsd: estimateCost(this.model, inputTokens, outputTokens),
          latencyMs: Date.now() - started,
        };
      } catch (error) {
        lastError = error;
        const retryable =
          error instanceof AIProviderError ? error.retryable : true;
        if (!retryable || attempt === 2) break;
        await new Promise((resolve) => setTimeout(resolve, 700 * attempt));
      }
    }

    if (lastError instanceof AIProviderError) throw lastError;
    throw new AIProviderError(
      lastError instanceof Error ? lastError.message : "AI request failed",
      this.key,
      false,
    );
  }

  analyzeNiche(evidence: AIEvidence, extra?: string) {
    return this.run(nicheAnalysisSchema, "niche_analysis", evidence, extra);
  }
  generateSubNiches(evidence: AIEvidence, extra?: string) {
    return this.run(subNicheSchema, "subniches", evidence, extra, 1_600);
  }
  generateVideoIdeas(evidence: AIEvidence, extra?: string) {
    return this.run(videoIdeasSchema, "video_ideas", evidence, extra, 2_000);
  }
  analyzeCompetition(evidence: AIEvidence, extra?: string) {
    return this.run(competitionSchema, "competition", evidence, extra, 1_600);
  }
  generateChannelStrategy(evidence: AIEvidence, extra?: string) {
    return this.run(channelStrategySchema, "channel_strategy", evidence, extra, 1_800);
  }
  generateResearchReport(evidence: AIEvidence, extra?: string) {
    return this.run(nicheAnalysisSchema, "research_report", evidence, extra, 3_000);
  }
}

export function createAgnesProvider(): OpenAICompatibleProvider | null {
  if (!env.AGNES_API_KEY) return null;
  return new OpenAICompatibleProvider({
    key: "agnes",
    name: "Agnes AI",
    baseUrl: env.AGNES_API_BASE_URL,
    model: env.AGNES_MODEL,
    apiKey: env.AGNES_API_KEY,
  });
}

export function createOpenAIProvider(): OpenAICompatibleProvider | null {
  if (!env.OPENAI_API_KEY) return null;
  return new OpenAICompatibleProvider({
    key: "openai",
    name: "OpenAI",
    baseUrl: env.OPENAI_API_BASE_URL,
    model: env.OPENAI_MODEL,
    apiKey: env.OPENAI_API_KEY,
  });
}
