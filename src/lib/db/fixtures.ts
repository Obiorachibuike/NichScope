import { computeOpportunityScore, type ScoringInputs } from "@/lib/services/ranking";
import { clamp, hashString, round } from "@/lib/utils";

/**
 * DEVELOPMENT / DEMO FIXTURES.
 *
 * These records are deterministic, clearly labelled (`isFixture = true`) and
 * only written when demo mode is enabled. They exist so the product can be
 * evaluated without licensed analytics credentials. They are never presented
 * as live YouTube statistics and every UI surface that shows them carries a
 * "Demo data" badge. Production deployments without a licensed provider show
 * empty states instead.
 */

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface FixtureMetricInput extends ScoringInputs {
  avgViews: number;
  medianViews: number;
  sampleVideoCount: number;
  sampleChannelCount: number;
  opportunityScore: number;
}

const PROFILE_BY_SLUG: Record<string, "emerging" | "declining" | "stable" | "hot"> = {
  "ai-agents": "hot",
  "ai-automation": "hot",
  "faceless-ai-video": "emerging",
  "ai-video-generation": "emerging",
  "llm-fine-tuning": "emerging",
  "no-code-ai-automation": "emerging",
  "personal-finance": "stable",
  "investing": "stable",
  "index-fund-investing": "stable",
  "true-crime": "stable",
  "mobile-gaming": "declining",
  "crypto-investing": "declining",
  "reaction-videos": "declining",
  "nft-investing": "declining",
};

/** Deterministic, plausible fixture metrics for one niche + period. */
export function fixtureMetric(slug: string, periodDays: 7 | 30 | 90): FixtureMetricInput {
  const rand = mulberry32(hashString(`${slug}:${periodDays}`));
  const profile = PROFILE_BY_SLUG[slug] ?? "stable";

  let growthBase =
    profile === "hot"
      ? 70 + rand() * 110
      : profile === "emerging"
        ? 45 + rand() * 70
        : profile === "declining"
          ? -38 + rand() * 22
          : -8 + rand() * 42;

  // Longer windows show smoother growth.
  growthBase *= periodDays === 90 ? 1.5 : periodDays === 30 ? 1 : 0.55;

  const competition =
    profile === "emerging" ? 20 + rand() * 30 : 25 + rand() * 65;
  const performance = 28 + rand() * 66;
  const channelGrowth =
    profile === "declining" ? -12 + rand() * 10 : 4 + rand() * 55;
  const engagement = 1.2 + rand() * 8;
  const consistency = 35 + rand() * 60;
  const viewsBase = 12_000 + rand() * 1_450_000;
  const avgViews = round(viewsBase * (periodDays === 90 ? 0.85 : 1), 0);
  const medianViews = round(avgViews * (0.35 + rand() * 0.3), 0);

  const inputs: ScoringInputs = {
    viewGrowthPct: round(growthBase, 2),
    channelGrowthPct: round(channelGrowth, 2),
    videoPerformanceScore: round(clamp(performance), 2),
    competitionScore: round(clamp(competition), 2),
    engagementRate: round(engagement, 2),
    consistencyScore: round(clamp(consistency), 2),
  };

  return {
    ...inputs,
    avgViews,
    medianViews,
    sampleVideoCount: Math.round(25 + rand() * 320),
    sampleChannelCount: Math.round(8 + rand() * 70),
    opportunityScore: computeOpportunityScore(inputs).score,
  };
}

export interface FixtureChannel {
  channelId: string;
  title: string;
  description: string;
  subscriberCount: number;
  viewCount: number;
  videoCount: number;
  country: string;
  publishedAt: Date;
}

export interface FixtureVideo {
  videoId: string;
  title: string;
  description: string;
  durationSeconds: number;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  format: "shorts" | "long_form";
  publishedAt: Date;
}

const CHANNEL_PREFIXES = [
  "Signal",
  "Northstar",
  "Evergreen",
  "Bright",
  "Field",
  "Deep",
  "Open",
  "Daily",
];
const CHANNEL_SUFFIXES = ["Labs", "Studio", "Media", "Works", "Channel", "HQ"];
const VIDEO_TEMPLATES = [
  "The complete {name} playbook for 2026",
  "I tested 7 {name} strategies — here's what worked",
  "{name}: what beginners get wrong",
  "How the {name} landscape is changing",
  "5 {name} opportunities nobody is talking about",
  "{name} explained in 12 minutes",
  "Why most creators fail at {name}",
  "A realistic {name} case study",
];

export function fixtureChannelsFor(
  nicheName: string,
  slug: string,
  count = 3,
): FixtureChannel[] {
  return Array.from({ length: count }, (_, index) => {
    const rand = mulberry32(hashString(`${slug}:channel:${index}`));
    const prefix = CHANNEL_PREFIXES[Math.floor(rand() * CHANNEL_PREFIXES.length)]!;
    const suffix = CHANNEL_SUFFIXES[Math.floor(rand() * CHANNEL_SUFFIXES.length)]!;
    const publishedYear = 2014 + Math.floor(rand() * 11);
    return {
      channelId: `demo-channel-${slug}-${index}`,
      title: `${prefix} ${suffix} · ${nicheName}`,
      description: `Demo fixture channel profile for ${nicheName}. Not a real YouTube channel.`,
      subscriberCount: Math.round(8_000 + rand() * 950_000),
      viewCount: Math.round(900_000 + rand() * 120_000_000),
      videoCount: Math.round(40 + rand() * 900),
      country: ["US", "GB", "CA", "NG", "DE", "IN"][Math.floor(rand() * 6)]!,
      publishedAt: new Date(Date.UTC(publishedYear, Math.floor(rand() * 12), 1)),
    };
  });
}

export function fixtureVideosFor(
  nicheName: string,
  slug: string,
  count = 4,
): FixtureVideo[] {
  return Array.from({ length: count }, (_, index) => {
    const rand = mulberry32(hashString(`${slug}:video:${index}`));
    const template = VIDEO_TEMPLATES[index % VIDEO_TEMPLATES.length]!;
    const isShort = rand() > 0.65;
    return {
      videoId: `demo-video-${slug}-${index}`,
      title: template.replaceAll("{name}", nicheName),
      description: `Demo fixture video listing for ${nicheName}. Not a real YouTube video.`,
      durationSeconds: isShort
        ? Math.round(15 + rand() * 45)
        : Math.round(240 + rand() * 1_100),
      viewCount: Math.round(2_000 + rand() * 2_400_000),
      likeCount: Math.round(100 + rand() * 90_000),
      commentCount: Math.round(10 + rand() * 4_000),
      format: isShort ? "shorts" : "long_form",
      publishedAt: new Date(Date.now() - Math.round(rand() * 240) * 86_400_000),
    };
  });
}

export function fixtureWatchlistNote(nicheName: string): string {
  return `Watching ${nicheName} for a Shorts-first test series. Revisit after the next ranking refresh.`;
}
