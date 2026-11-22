import { clamp } from "@/lib/utils";
import {
  type AIEvidence,
  type AIProvider,
  type AIResult,
  type ChannelStrategy,
  type CompetitionAnalysis,
  type NicheAnalysis,
  type SubNicheSuggestions,
  type VideoIdeas,
} from "./types";

/**
 * Deterministic offline "AI" provider used when no model credentials are
 * configured (and as the final fallback in demo mode). It is explicitly
 * labelled as a fixture generator in the UI and in the stored report, produces
 * no invented statistics, and never claims to be a language model.
 */
export class FixtureAIProvider implements AIProvider {
  readonly key = "fixture";
  readonly model = "nichscope-offline-fixture-v1";

  private result<T>(data: T): AIResult<T> {
    const serialised = JSON.stringify(data);
    return {
      data,
      raw: null,
      model: this.model,
      provider: this.key,
      inputTokens: 0,
      outputTokens: Math.ceil(serialised.length / 4),
      costUsd: 0,
      latencyMs: 0,
    };
  }

  private classification(evidence: AIEvidence) {
    const verified = [
      `Niche "${evidence.niche.name}" exists in the ${evidence.niche.category} category of the NicheScope taxonomy.`,
    ];
    if (evidence.subNiches.length > 0) {
      verified.push(
        `Taxonomy sub-niches: ${evidence.subNiches.slice(0, 6).join(", ")}.`,
      );
    }
    const estimated = evidence.metrics
      ? [
          `Opportunity score ${evidence.metrics.opportunityScore ?? "—"}/100 for the ${evidence.metrics.period} window (${evidence.metrics.sourceName}${evidence.metrics.isFixture ? ", demo fixture" : ""}).`,
          `Average views ${evidence.metrics.avgViews ?? "—"} across ${evidence.metrics.sampleVideoCount} sampled videos.`,
        ]
      : [];
    return {
      verified,
      estimated,
      aiRecommendations: [
        "Audience, format and positioning guidance below is generated advice, not measured YouTube data.",
      ],
    };
  }

  private buildNicheAnalysis(evidence: AIEvidence): NicheAnalysis {
    const name = evidence.niche.name;
    const category = evidence.niche.category;
    const keywords = evidence.niche.taxonomyKeywords.slice(0, 5);
    const subNiches =
      evidence.subNiches.length > 0
        ? evidence.subNiches
        : keywords.slice(0, 4).map((keyword) => `${name}: ${keyword}`);

    return {
      overview: `${name} sits inside the ${category} category. ${
        evidence.niche.description ??
        "The taxonomy profile covers creators, formats and search keywords for this niche."
      } This report is generated from taxonomy facts${
        evidence.metrics ? " and the labelled estimate attached to this niche" : ""
      }; no additional YouTube statistics were used.`,
      targetAudience: [
        {
          segment: `People actively researching ${name.toLowerCase()}`,
          description:
            "Search-driven viewers looking for practical explanations, comparisons and step-by-step guidance.",
          motivation: "Solve a specific problem quickly, then subscribe for depth.",
        },
        {
          segment: `Creators studying ${name.toLowerCase()}`,
          description:
            "Aspiring and working creators who want to understand formats before committing to a channel.",
          motivation: "Reduce risk before investing production time.",
        },
      ],
      audienceProblems: [
        `Too much scattered ${name.toLowerCase()} advice with little structure or proof.`,
        "Difficulty judging which approaches are current rather than outdated.",
        "No clear next step after the first tutorial is watched.",
      ],
      subNiches: subNiches.slice(0, 8).map((sub) => ({
        name: sub,
        rationale: `Narrower framing of ${name.toLowerCase()} with a clearer audience promise.`,
        recommendedFormat: "long_form",
      })),
      competitionObservations: evidence.metrics
        ? [
            `Competition estimate: ${evidence.metrics.competitionScore ?? "—"}/100 (${evidence.metrics.confidence}, ${evidence.metrics.sourceName}).`,
            "Higher competition does not block entry — it shifts the winning angle toward specificity and proof.",
          ]
        : [
            "No permitted competition metrics are available for this niche, so no competition score is asserted.",
            "Use the Channels tab after a licensed data source or live YouTube lookup is configured to inspect individual competitors.",
          ],
      facelessSuitability: {
        score: clamp(
          55 +
            (evidence.niche.formats.includes("shorts") ? 12 : 0) +
            (keywords.some((k) => /ai|faceless|automation/i.test(k)) ? 15 : 0),
        ),
        rationale:
          "Generated suitability assessment based on taxonomy formats and keywords, not on channel measurements.",
        formats: ["voiceover explainer", "screen-recorded walkthrough", "data/motion explainer"],
      },
      contentFormats: [
        {
          format: "Long-form explainer (8–14 min)",
          description: `Structured deep dive that resolves one ${name.toLowerCase()} question completely.`,
          cadence: "1–2 per week",
        },
        {
          format: "Shorts (20–45s)",
          description: "Single insight, sharp hook, loop-friendly payoff.",
          cadence: "3–5 per week",
        },
        {
          format: "Comparison / teardown",
          description: "Side-by-side evaluation with a clear recommendation.",
          cadence: "Every second week",
        },
      ],
      positioning:
        `Become the most concrete ${name.toLowerCase()} channel for ${category.toLowerCase()} learners: every video delivers a usable next step, not just commentary.`,
      differentiation: [
        "Show the process and the evidence rather than summarising others.",
        "Publish one repeatable series with a recognisable structure.",
        "Include a clear 'what to do next' close in every video.",
      ],
      videoTopics: keywords.slice(0, 6).map((keyword) => ({
        title: `${keyword} explained with a real example`,
        angle: "Practical walkthrough with a measurable outcome.",
        format: "long_form",
      })),
      risks: [
        "Advice can age quickly — date-stamp claims and revisit them.",
        "Avoid unverified numbers; cite only sources you can link.",
        "If the topic touches health or finance, add a clear disclaimer.",
      ],
      nextSteps: [
        "Add 3–5 candidate niches to your watchlist.",
        "Validate demand with 3 test videos before committing to a series.",
        "Configure a licensed analytics provider to unlock ranking-based evidence.",
      ],
      evidenceClassification: this.classification(evidence),
    };
  }

  async analyzeNiche(evidence: AIEvidence): Promise<AIResult<NicheAnalysis>> {
    return this.result(this.buildNicheAnalysis(evidence));
  }

  async generateResearchReport(evidence: AIEvidence): Promise<AIResult<NicheAnalysis>> {
    return this.result(this.buildNicheAnalysis(evidence));
  }

  async generateSubNiches(
    evidence: AIEvidence,
  ): Promise<AIResult<SubNicheSuggestions>> {
    const name = evidence.niche.name;
    const keywords = evidence.niche.taxonomyKeywords.slice(0, 6);
    const base =
      evidence.subNiches.length > 0
        ? evidence.subNiches
        : keywords.map((keyword) => `${name}: ${keyword}`);
    return this.result({
      subNiches: base.slice(0, 10).map((sub, index) => ({
        name: sub,
        rationale: `Focus area ${index + 1} derived from the taxonomy profile for ${name.toLowerCase()}.`,
        audience: "Viewers seeking a specific, practical outcome.",
        recommendedFormat: index % 2 === 0 ? "long_form" : "shorts",
        difficulty: (index % 3 === 0 ? "low" : index % 3 === 1 ? "medium" : "high") as
          | "low"
          | "medium"
          | "high",
      })),
      notes: [
        "Generated from taxonomy keywords only; validate each angle with a small test series.",
      ],
    });
  }

  async generateVideoIdeas(evidence: AIEvidence): Promise<AIResult<VideoIdeas>> {
    const name = evidence.niche.name;
    const keywords = evidence.niche.taxonomyKeywords.slice(0, 6);
    const templates = [
      { prefix: "The honest beginner guide to", format: "long_form" as const },
      { prefix: "3 mistakes people make with", format: "short" as const },
      { prefix: "I tested the most common", format: "long_form" as const },
      { prefix: "What nobody tells you about", format: "short" as const },
      { prefix: "A 7-day plan for", format: "long_form" as const },
      { prefix: "Is it still worth starting", format: "long_form" as const },
    ];
    const ideas = keywords.flatMap((keyword, index) => {
      const template = templates[index % templates.length]!;
      return [
        {
          title: `${template.prefix} ${keyword}`,
          hook: `Open with the most common misconception about ${keyword}, then promise a concrete fix.`,
          format: template.format,
          rationale: "Targets an explicit search intent from the taxonomy keyword map.",
          difficulty: index % 2 === 0 ? ("low" as const) : ("medium" as const),
        },
      ];
    });
    return this.result({
      ideas: ideas.slice(0, 12).map((idea) => ({ ...idea, title: `${idea.title} (${name})` })),
      notes: [
        "Titles are generated suggestions. Check search interest and existing competition before producing.",
      ],
    });
  }

  async analyzeCompetition(
    evidence: AIEvidence,
  ): Promise<AIResult<CompetitionAnalysis>> {
    const metrics = evidence.metrics;
    return this.result({
      observations: metrics
        ? [
            `Competition estimate ${metrics.competitionScore ?? "—"}/100 (${metrics.sourceName}, ${metrics.confidence}).`,
            `Estimate derived from ${metrics.sampleChannelCount} sampled channels in the ${metrics.period} window.`,
          ]
        : [
            "No permitted competition metrics are attached, so no competition score is asserted.",
          ],
      differentiation: [
        "Pick one narrow promise and keep every video accountable to it.",
        "Document real processes instead of restating public summaries.",
        "Use series formatting so new viewers can binge in order.",
      ],
      risks: [
        metrics?.isFixture
          ? "The attached metrics are demo fixtures; do not treat them as market evidence."
          : "Estimates can lag reality — refresh data before making a big production decision.",
      ],
      opportunities: [
        "Sub-niche depth is usually less contested than broad coverage.",
        "Shorts can seed demand for longer explainers in the same series.",
      ],
      evidenceClassification: this.classification(evidence),
    });
  }

  async generateChannelStrategy(
    evidence: AIEvidence,
  ): Promise<AIResult<ChannelStrategy>> {
    const name = evidence.niche.name;
    return this.result({
      positioning: `A ${name.toLowerCase()} channel built around provable, step-by-step outcomes for ${evidence.niche.category.toLowerCase()} learners.`,
      audiencePromise:
        "Every upload leaves you with one thing you can apply today — and the reasoning behind it.",
      seriesIdeas: [
        {
          name: "Fundamentals",
          description: `Permanent explainers covering the core of ${name.toLowerCase()}.`,
        },
        {
          name: "Real tests",
          description: "Documented experiments with transparent method and results.",
        },
        {
          name: "Tools & comparisons",
          description: "Decision-focused evaluations with a clear recommendation.",
        },
      ],
      cadence: "1 long-form video per week plus 3 Shorts cut from the same research.",
      monetization: [
        "Ad revenue once eligibility is met — do not assume eligibility.",
        "Sponsorships from tools that genuinely fit the workflow.",
        "Digital templates or courses after the channel proves demand.",
      ],
      firstNinetyDays: [
        "Publish 6 long-form videos across 2 series and 12 Shorts.",
        "Measure retention on the first 30 seconds and iterate on hooks.",
        "Collect viewer questions and turn the best into a follow-up series.",
        "Review the niche's eligible rankings monthly if a licensed source is enabled.",
      ],
      differentiation: [
        "Transparent methodology.",
        "Consistent series structure.",
        "Explicit updates when advice changes.",
      ],
      risks: [
        "Do not assert market size or earnings without a permitted data source.",
        "Avoid over-producing before one format proves itself.",
      ],
    });
  }
}
