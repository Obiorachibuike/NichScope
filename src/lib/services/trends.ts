import type { Database } from "@/lib/db/client";
import { demoMode, youtubeConfigured } from "@/lib/env";
import { listRankings, type RankingCategory, type RankingPeriod } from "./ranking";
import { fetchSupportedRegions } from "./youtube/sync";

/**
 * Global discovery. Rankings here are always global and attributed to their
 * data source. Country selection never implies a geographic popularity claim —
 * those require a licensed provider whose contract permits them.
 */
export interface TrendsData {
  groups: {
    category: RankingCategory;
    label: string;
    description: string;
    items: Awaited<ReturnType<typeof listRankings>>;
  }[];
  regions: { code: string; name: string }[];
  regionSource: "youtube_api" | "unavailable";
  notes: string[];
  demoData: boolean;
  period: RankingPeriod;
}

const GROUP_META: Record<RankingCategory, { label: string; description: string }> = {
  top_performing: {
    label: "Top performing",
    description: "Composite of opportunity score and video performance.",
  },
  highest_growth: {
    label: "Highest growth",
    description: "Ranked by recent view growth in the measurement window.",
  },
  opportunity: {
    label: "Best opportunity",
    description: "Weighted opportunity model with competition inversion.",
  },
  low_competition: {
    label: "Lowest competition",
    description: "Approachable niches with room for a new entrant.",
  },
  emerging: {
    label: "Emerging",
    description: "Elevated growth with comparatively low competition.",
  },
  declining: {
    label: "Declining",
    description: "Negative growth signals — approach with caution.",
  },
};

export async function getTrends(
  db: Database,
  options: { period?: RankingPeriod; limit?: number; categories?: RankingCategory[] } = {},
): Promise<TrendsData> {
  const period = options.period ?? "30d";
  const limit = options.limit ?? 10;
  const categories =
    options.categories ??
    ([
      "top_performing",
      "highest_growth",
      "emerging",
      "low_competition",
      "declining",
    ] as RankingCategory[]);

  const groups = await Promise.all(
    categories.map(async (category) => ({
      category,
      label: GROUP_META[category].label,
      description: GROUP_META[category].description,
      items: await listRankings(db, { category, period, limit }),
    })),
  );

  let regions: { code: string; name: string }[] = [];
  let regionSource: "youtube_api" | "unavailable" = "unavailable";
  let regionError: string | null = null;

  if (youtubeConfigured) {
    const result = await fetchSupportedRegions(db);
    regions = result.regions;
    regionSource = result.error ? "unavailable" : "youtube_api";
    regionError = result.error;
  }

  const notes: string[] = [];
  if (regionError) {
    notes.push(
      `Supported YouTube regions could not be loaded: ${regionError}. Ranking groups below remain global.`,
    );
  }
  if (!youtubeConfigured) {
    notes.push(
      "Region metadata requires the official YouTube Data API. Set YOUTUBE_API_KEY to populate supported regions.",
    );
  }
  notes.push(
    "NicheScope does not claim geographic popularity for a niche unless a licensed data source explicitly permits it. Region selection affects live YouTube lookups, not this ranking set.",
  );
  if (demoMode) {
    notes.push(
      "Rankings shown are generated from clearly-labelled demo fixtures, not live YouTube data.",
    );
  }

  return {
    groups,
    regions,
    regionSource,
    notes,
    demoData: demoMode,
    period,
  };
}
