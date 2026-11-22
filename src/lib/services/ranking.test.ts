import { describe, expect, it } from "vitest";
import {
  DEFAULT_WEIGHTS,
  SCORING_VERSION,
  computeOpportunityScore,
  explainScore,
  normaliseChannelGrowth,
  normaliseEngagement,
  normaliseGrowth,
  qualifiesForCategory,
  scoreForCategory,
  type ScoringInputs,
} from "./ranking";

const baseInput: ScoringInputs = {
  viewGrowthPct: 30,
  channelGrowthPct: 20,
  videoPerformanceScore: 70,
  competitionScore: 40,
  engagementRate: 6,
  consistencyScore: 80,
};

describe("normalisation", () => {
  it("maps growth percentage onto a clamped 0–100 scale", () => {
    expect(normaliseGrowth(-50)).toBe(0);
    expect(normaliseGrowth(50)).toBe(50);
    expect(normaliseGrowth(150)).toBe(100);
    expect(normaliseGrowth(1_000)).toBe(100);
    expect(normaliseGrowth(-1_000)).toBe(0);
  });

  it("normalises channel growth and engagement independently", () => {
    expect(normaliseChannelGrowth(-20)).toBe(0);
    expect(normaliseChannelGrowth(30)).toBe(50);
    expect(normaliseChannelGrowth(80)).toBe(100);
    expect(normaliseEngagement(0)).toBe(0);
    expect(normaliseEngagement(6)).toBe(50);
    expect(normaliseEngagement(24)).toBe(100);
  });
});

describe("computeOpportunityScore", () => {
  it("uses the documented weights, which must total 100", () => {
    const total = Object.values(DEFAULT_WEIGHTS).reduce((sum, weight) => sum + weight, 0);
    expect(total).toBe(100);
    expect(DEFAULT_WEIGHTS.recentGrowth).toBe(25);
    expect(DEFAULT_WEIGHTS.channelGrowth).toBe(20);
    expect(DEFAULT_WEIGHTS.videoPerformance).toBe(20);
    expect(DEFAULT_WEIGHTS.competitionOpportunity).toBe(20);
    expect(DEFAULT_WEIGHTS.engagement).toBe(10);
    expect(DEFAULT_WEIGHTS.contentConsistency).toBe(5);
  });

  it("produces a 0–100 score whose components sum to the score", () => {
    const breakdown = computeOpportunityScore(baseInput);
    expect(breakdown.score).toBeGreaterThan(0);
    expect(breakdown.score).toBeLessThanOrEqual(100);
    const sum = Object.values(breakdown.components).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(breakdown.score, 1);
  });

  it("inverts competition: higher competition lowers the score", () => {
    const lowCompetition = computeOpportunityScore({ ...baseInput, competitionScore: 10 });
    const highCompetition = computeOpportunityScore({ ...baseInput, competitionScore: 90 });
    expect(lowCompetition.score).toBeGreaterThan(highCompetition.score);
    expect(lowCompetition.normalised.competitionOpportunity).toBeGreaterThan(
      highCompetition.normalised.competitionOpportunity,
    );
  });

  it("clamps out-of-range inputs rather than producing impossible scores", () => {
    const breakdown = computeOpportunityScore({
      viewGrowthPct: 10_000,
      channelGrowthPct: 10_000,
      videoPerformanceScore: 1_000,
      competitionScore: -50,
      engagementRate: 100,
      consistencyScore: 1_000,
    });
    expect(breakdown.score).toBe(100);
    expect(breakdown.score).toBeLessThanOrEqual(100);
  });

  it("supports custom weights and scales by their total", () => {
    const breakdown = computeOpportunityScore(
      { ...baseInput, viewGrowthPct: 150, channelGrowthPct: 80, competitionScore: 0 },
      { ...DEFAULT_WEIGHTS, recentGrowth: 10, contentConsistency: 0 },
    );
    expect(Object.keys(breakdown.components)).toContain("recentGrowth");
    expect(breakdown.score).toBeLessThanOrEqual(100);
  });

  it("explains the score with version, weights and contributions", () => {
    const breakdown = computeOpportunityScore(baseInput);
    const explanation = explainScore(baseInput, breakdown);
    expect(explanation).toContain(SCORING_VERSION);
    expect(explanation).toContain("competition 40/100");
    expect(explanation).toContain("recent view growth 30.0%");
    expect(explanation).toContain(`Opportunity score ${breakdown.score}/100`);
  });
});

describe("ranking categories", () => {
  const metric = { opportunity: 80, growth: 50, competition: 30, performance: 90 };

  it("weights top-performing as half opportunity, half performance", () => {
    expect(scoreForCategory("top_performing", metric)).toBe(85);
  });

  it("uses the documented category formulas", () => {
    expect(scoreForCategory("highest_growth", metric)).toBe(50);
    expect(scoreForCategory("opportunity", metric)).toBe(80);
    expect(scoreForCategory("low_competition", metric)).toBe(73);
    expect(scoreForCategory("emerging", metric)).toBe(62);
    expect(scoreForCategory("declining", metric)).toBe(50);
  });

  it("requires emerging niches to have strong growth and manageable competition", () => {
    expect(
      qualifiesForCategory("emerging", { growth: 40, competition: 60, sampleVideoCount: 12 }),
    ).toBe(true);
    expect(
      qualifiesForCategory("emerging", { growth: 39, competition: 20, sampleVideoCount: 12 }),
    ).toBe(false);
    expect(
      qualifiesForCategory("emerging", { growth: 80, competition: 61, sampleVideoCount: 12 }),
    ).toBe(false);
  });

  it("only marks negative growth as declining and low competition below 55", () => {
    expect(
      qualifiesForCategory("declining", { growth: -2.1, competition: 30, sampleVideoCount: 8 }),
    ).toBe(true);
    expect(
      qualifiesForCategory("declining", { growth: -2, competition: 30, sampleVideoCount: 8 }),
    ).toBe(false);
    expect(
      qualifiesForCategory("low_competition", { growth: 0, competition: 54.9, sampleVideoCount: 8 }),
    ).toBe(true);
    expect(
      qualifiesForCategory("low_competition", { growth: 0, competition: 55, sampleVideoCount: 8 }),
    ).toBe(false);
    expect(
      qualifiesForCategory("top_performing", { growth: 0, competition: 99, sampleVideoCount: 8 }),
    ).toBe(true);
  });
});
