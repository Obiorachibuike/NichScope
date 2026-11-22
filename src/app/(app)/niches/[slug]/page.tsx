import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpRight,
  BarChart3,
  BrainCircuit,
  Layers,
  Search,
  Sparkles,
  Tag,
  PlaySquare,
} from "lucide-react";
import { and, eq } from "drizzle-orm";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { ScoreDial } from "@/components/score-bar";
import {
  ComplianceNote,
  ConfidenceBadge,
  DemoBadge,
} from "@/components/data-badges";
import { NicheCard } from "@/components/niche-card";
import { SaveNicheButton } from "@/components/save-niche-button";
import { GrowthTrendChart, MetricRadar } from "@/components/charts";
import { ChannelCard, VideoCard } from "@/components/media-cards";
import { LiveLookupButton } from "@/components/live-lookup-button";
import { AiAdvisorForm } from "@/components/ai-advisor-form";
import { requireUser } from "@/lib/auth/session";
import { getReadyDb } from "@/lib/db/ready";
import { nicheWatchlists } from "@/lib/db/schema";
import {
  getNicheBySlug,
  listNiches,
  nicheFilterSchema,
} from "@/lib/services/niches";
import { getNicheMedia } from "@/lib/services/research";
import { recordNicheView } from "@/lib/services/dashboard";
import { getAiUsage } from "@/lib/services/ai";
import { youtubeConfigured } from "@/lib/env";

import { clamp, formatDate, formatNumber, formatPercent, titleCase } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  try {
    const db = await getReadyDb();
    const detail = await getNicheBySlug(db, slug);
    if (!detail) return { title: "Niche not found" };
    return {
      title: `${detail.niche.name} niche research`,
      description:
        detail.niche.description ??
        `Research the ${detail.niche.name} YouTube niche: keywords, sub-niches and data-source-attributed metrics.`,
    };
  } catch {
    return { title: "Niche research" };
  }
}

const CATEGORY_LABELS: Record<string, string> = {
  opportunity: "Opportunity",
  top_performing: "Top performing",
  highest_growth: "Highest growth",
  low_competition: "Low competition",
  emerging: "Emerging",
  declining: "Declining",
};

export default async function NicheDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await requireUser(`/niches/${slug}`);
  const db = await getReadyDb();
  const detail = await getNicheBySlug(db, slug);
  if (!detail) notFound();

  await recordNicheView(db, user.id, detail.niche.id);

  const [media, children, savedRows, usage] = await Promise.all([
    getNicheMedia(db, detail.niche.id),
    listNiches(db, {
      ...nicheFilterSchema.parse({}),
      parent: slug,
      pageSize: 24,
    }),
    db
      .select({ id: nicheWatchlists.id })
      .from(nicheWatchlists)
      .where(
        and(
          eq(nicheWatchlists.userId, user.id),
          eq(nicheWatchlists.nicheId, detail.niche.id),
        ),
      )
      .limit(1),
    getAiUsage(db, user.id, user.plan),
  ]);

  const latest =
    detail.metrics.find((metric) => metric.period === "30d") ?? detail.metrics[0] ?? null;
  const hasMetrics = detail.metrics.length > 0;
  const score = latest?.opportunityScore ?? (detail.niche.opportunityScore === null ? null : Number(detail.niche.opportunityScore));

  const chartData = detail.metrics.map((metric) => ({
    period:
      metric.period === "7d"
        ? "7 days"
        : metric.period === "30d"
          ? "30 days"
          : "90 days",
    growth: metric.viewGrowthPct,
    opportunity: metric.opportunityScore,
  }));

  const radarData = latest
    ? [
        {
          metric: "Growth",
          value: Math.round(clamp(((latest.viewGrowthPct ?? 0) + 50) / 2)),
        },
        {
          metric: "Performance",
          value: Math.round(latest.videoPerformanceScore ?? 0),
        },
        {
          metric: "Low competition",
          value: Math.round(100 - (latest.competitionScore ?? 50)),
        },
        {
          metric: "Engagement",
          value: Math.round(clamp(((latest.engagementRate ?? 0) / 12) * 100)),
        },
        {
          metric: "Consistency",
          value: Math.round(latest.consistencyScore ?? 0),
        },
        {
          metric: "Channel growth",
          value: Math.round(clamp(((latest.channelGrowthPct ?? 0) + 20) / 100 * 100)),
        },
      ]
    : [];

  const opportunityRanking = detail.rankings.find(
    (ranking) => ranking.category === "opportunity" && ranking.period === "30d",
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
        <Link href="/niches" className="flex items-center gap-1 hover:text-foreground">
          <ArrowLeft className="size-3" /> Niche Explorer
        </Link>
        <span className="text-border-strong">/</span>
        <Link
          href={`/niches?category=${detail.category.slug}`}
          className="hover:text-foreground"
        >
          {detail.category.name}
        </Link>
        {detail.parent && (
          <>
            <span className="text-border-strong">/</span>
            <Link href={`/niches/${detail.parent.slug}`} className="hover:text-foreground">
              {detail.parent.name}
            </Link>
          </>
        )}
      </div>

      <PageHeader
        title={detail.niche.name}
        eyebrow={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="normal-case">
              {detail.category.name}
            </Badge>
            {detail.niche.formats.includes("shorts") && (
              <Badge variant="outline" className="normal-case">Shorts</Badge>
            )}
            {detail.niche.formats.includes("long_form") && (
              <Badge variant="outline" className="normal-case">Long-form</Badge>
            )}
            {latest?.isFixture && <DemoBadge />}
            <ConfidenceBadge confidence={detail.niche.dataConfidence} />
          </div>
        }
        description={detail.niche.description ?? undefined}
        actions={
          <>
            <SaveNicheButton
              slug={detail.niche.slug}
              initialSaved={savedRows.length > 0}
              watchlistId={savedRows[0]?.id}
              showLabel
            />
            <Button asChild variant="secondary" size="sm">
              <Link href={`/advisor?niche=${detail.niche.slug}`}>
                <Sparkles className="size-4" /> AI analysis
              </Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <a
                href={`https://www.youtube.com/results?search_query=${encodeURIComponent(detail.niche.name)}`}
                target="_blank"
                rel="noreferrer noopener"
              >
                <PlaySquare className="size-4" /> Search YouTube
              </a>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <CardContent className="grid gap-5 p-5 sm:grid-cols-[auto_1fr]">
            <div className="flex flex-col items-center gap-2">
              <ScoreDial score={score} />
              <span className="text-[10px] uppercase tracking-wide text-muted">
                Opportunity score
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Metric label="View growth" value={latest ? formatPercent(latest.viewGrowthPct) : "—"} tone={latest && (latest.viewGrowthPct ?? 0) < 0 ? "danger" : "primary"} />
              <Metric label="Avg views" value={latest ? formatNumber(latest.avgViews) : "—"} />
              <Metric label="Competition" value={latest?.competitionScore !== null && latest?.competitionScore !== undefined ? `${latest.competitionScore.toFixed(0)}/100` : titleCase(detail.niche.competitionLevel)} />
              <Metric label="Engagement" value={latest?.engagementRate != null ? `${latest.engagementRate.toFixed(1)}%` : "—"} />
              <Metric label="Sample videos" value={latest ? formatNumber(latest.sampleVideoCount) : "—"} />
              <Metric label="Sample channels" value={latest ? formatNumber(latest.sampleChannelCount) : "—"} />
              <Metric label="30d rank" value={opportunityRanking ? `#${opportunityRanking.rank}` : "Not ranked"} />
              <Metric label="Source" value={latest?.sourceName ?? "None"} small />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Taxonomy profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <Row label="Monetization" value={titleCase(detail.niche.monetizationPotential)} />
            <Row label="Growth trend" value={titleCase(detail.niche.growthTrend)} />
            <Row label="Sub-niches" value={String(detail.counts.subNiches)} />
            <Row label="Channels stored" value={String(detail.counts.channels)} />
            <Row label="Videos stored" value={String(detail.counts.videos)} />
            <Row label="Languages" value={detail.niche.primaryLanguage ?? "Not specified"} />
            <Row
              label="Countries"
              value={detail.niche.countries.length > 0 ? detail.niche.countries.join(", ") : "Global / not specified"}
            />
            <Row label="Last updated" value={formatDate(detail.niche.updatedAt)} />
          </CardContent>
        </Card>
      </div>

      {detail.niche.aliases.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
          <span className="text-muted">Also known as</span>
          {detail.niche.aliases.map((alias) => (
            <Link
              key={alias}
              href={`/niches?q=${encodeURIComponent(alias)}`}
              className="rounded-full border border-border px-2 py-0.5 hover:border-border-strong hover:text-muted-strong"
            >
              {alias}
            </Link>
          ))}
        </div>
      )}

      <Tabs defaultValue="overview">
        <div className="overflow-x-auto pb-1 scrollbar-thin">
          <TabsList>
            <TabsTrigger value="overview">
              <BarChart3 className="size-3.5" /> Overview
            </TabsTrigger>
            <TabsTrigger value="videos">
              Videos ({detail.counts.videos})
            </TabsTrigger>
            <TabsTrigger value="channels">
              Channels ({detail.counts.channels})
            </TabsTrigger>
            <TabsTrigger value="subniches">
              Sub-niches ({detail.counts.subNiches})
            </TabsTrigger>
            <TabsTrigger value="keywords">
              Keywords ({detail.keywords.length})
            </TabsTrigger>
            <TabsTrigger value="ai">
              <BrainCircuit className="size-3.5" /> AI analysis
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="space-y-4">
          {!hasMetrics ? (
            <Card>
              <CardContent className="pt-5">
                <EmptyState
                  icon={BarChart3}
                  tone="warning"
                  title="No performance metrics available"
                  description="This niche has taxonomy data but no eligible performance source. NicheScope does not display invented growth, competition or opportunity scores."
                  action={
                    <Button asChild size="sm" variant="secondary">
                      <Link href="/trends">See data source status</Link>
                    </Button>
                  }
                />
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Growth & opportunity by window</CardTitle>
                  <CardDescription>
                    Estimated values from {latest?.sourceName}. Hover for detail.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <GrowthTrendChart data={chartData} />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Score components</CardTitle>
                  <CardDescription>
                    Normalised inputs for the latest 30-day estimate.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <MetricRadar data={radarData} />
                </CardContent>
              </Card>
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Ranking positions</CardTitle>
                <CardDescription>
                  Only categories produced by an eligible source appear as ranked.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {detail.rankings.length === 0 ? (
                  <p className="text-xs text-muted">
                    This niche is not ranked in any published category.
                  </p>
                ) : (
                  (["opportunity", "top_performing", "highest_growth", "low_competition", "emerging", "declining"] as const).map((category) => {
                    const ranking = detail.rankings.find(
                      (item) => item.category === category && item.period === "30d",
                    );
                    return (
                      <div
                        key={category}
                        className="flex items-center justify-between gap-3 rounded-lg border border-border/70 px-3 py-2"
                      >
                        <span className="text-xs text-muted-strong">
                          {CATEGORY_LABELS[category]}
                        </span>
                        <span className="flex items-center gap-2 text-xs">
                          {ranking ? (
                            <>
                              <span className="font-mono font-semibold text-foreground">
                                #{ranking.rank}
                              </span>
                              <span className="text-muted">/100 score {ranking.score.toFixed(1)}</span>
                              {ranking.isFixture && <DemoBadge />}
                            </>
                          ) : (
                            <span className="text-muted">Not ranked</span>
                          )}
                        </span>
                      </div>
                    );
                  })
                )}
                {opportunityRanking?.explanation && (
                  <details className="mt-2 rounded-lg border border-border bg-surface px-3 py-2 text-[11px] text-muted">
                    <summary className="cursor-pointer font-medium text-muted-strong">
                      How this score was calculated
                    </summary>
                    <p className="mt-2 leading-relaxed">{opportunityRanking.explanation}</p>
                  </details>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Data provenance</CardTitle>
                <CardDescription>
                  Source, confidence and calculation time for every window.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {detail.metrics.length === 0 ? (
                  <p className="text-xs text-muted">No metrics rows exist for this niche.</p>
                ) : (
                  <div className="overflow-x-auto scrollbar-thin">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left text-[10px] uppercase tracking-wide text-muted">
                          <th className="pb-2 pr-3 font-medium">Window</th>
                          <th className="pb-2 pr-3 font-medium">Source</th>
                          <th className="pb-2 pr-3 font-medium">Confidence</th>
                          <th className="pb-2 font-medium">Computed</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.metrics.map((metric) => (
                          <tr key={metric.period} className="border-t border-border/60">
                            <td className="py-2 pr-3">{metric.period}</td>
                            <td className="py-2 pr-3">
                              <span className="flex flex-wrap items-center gap-1">
                                {metric.sourceName}
                                {metric.isFixture && <DemoBadge />}
                              </span>
                            </td>
                            <td className="py-2 pr-3">
                              <ConfidenceBadge confidence={metric.confidence} />
                            </td>
                            <td className="py-2 text-muted">{formatDate(metric.computedAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <ComplianceNote className="mt-3">
                  Estimates are labelled and never presented as verified facts. Public
                  YouTube data is retained for at most 30 days; licensed metrics follow
                  the contract's retention terms.
                </ComplianceNote>
              </CardContent>
            </Card>
          </div>

          {detail.related.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Related niches in {detail.category.name}</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {detail.related.map((related) => (
                  <Link
                    key={related.id}
                    href={`/niches/${related.slug}`}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border/70 px-3 py-2 text-xs hover:border-border-strong hover:bg-card-elevated/40"
                  >
                    <span className="truncate font-medium">{related.name}</span>
                    <span className="shrink-0 text-muted">
                      {related.opportunityScore === null ? "—" : `${related.opportunityScore.toFixed(0)}`}
                    </span>
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="videos" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted">
              Stored video metadata attributed to its source. Format is estimated from duration.
            </p>
            {youtubeConfigured ? (
              <LiveLookupButton slug={detail.niche.slug} kind="videos" query={detail.niche.name} />
            ) : (
              <Badge variant="muted">Live YouTube disabled — no API key</Badge>
            )}
          </div>
          {media.videos.length === 0 ? (
            <EmptyState
              icon={PlaySquare}
              title="No videos stored for this niche"
              description={
                youtubeConfigured
                  ? "Run a live lookup to fetch the latest public videos from the YouTube Data API."
                  : "Configure YOUTUBE_API_KEY to fetch public video metadata. NicheScope never scrapes YouTube."
              }
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {media.videos.map((video) => (
                <VideoCard key={video.id} video={{ ...video, sourceName: video.sourceName }} />
              ))}
            </div>
          )}
          <ComplianceNote>
            Video records are individual public metadata rows. NicheScope does not
            compute cross-channel video rankings from YouTube API data.
          </ComplianceNote>
        </TabsContent>

        <TabsContent value="channels" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted">
              Individual channels attributed to the source and retrieval time.
            </p>
            {youtubeConfigured ? (
              <LiveLookupButton slug={detail.niche.slug} kind="channels" query={detail.niche.name} />
            ) : (
              <Badge variant="muted">Live YouTube disabled — no API key</Badge>
            )}
          </div>
          {media.channels.length === 0 ? (
            <EmptyState
              icon={PlaySquare}
              title="No channels stored for this niche"
              description="Channel research requires either stored records or a live YouTube Data API lookup."
            />
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {media.channels.map((channel) => (
                <ChannelCard key={channel.id} channel={{ ...channel, sourceName: channel.sourceName }} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="subniches" className="space-y-4">
          {children.items.length === 0 ? (
            <EmptyState
              icon={Layers}
              title="No sub-niches yet"
              description="This niche is a leaf in the taxonomy. Explore related niches or propose sub-niches via the AI advisor."
              action={
                <Button asChild size="sm" variant="secondary">
                  <Link href={`/subniches?category=${detail.category.slug}`}>
                    Browse other sub-niches
                  </Link>
                </Button>
              }
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {children.items.map((child) => (
                <NicheCard key={child.id} niche={{ ...child }} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="keywords">
          <Card>
            <CardHeader>
              <CardTitle>Keyword map</CardTitle>
              <CardDescription>
                Taxonomy keywords and aliases used for search. These are not search-volume claims.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {detail.keywords.length === 0 ? (
                <EmptyState
                  icon={Tag}
                  title="No keywords mapped"
                  description="Add taxonomy keywords from the admin panel to improve discoverability."
                />
              ) : (
                <div className="flex flex-wrap gap-2">
                  {detail.keywords.map((keyword) => (
                    <Link
                      key={keyword.keyword}
                      href={`/niches?q=${encodeURIComponent(keyword.keyword)}`}
                      className="group flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-muted-strong transition-colors hover:border-primary/40 hover:text-primary"
                    >
                      <Search className="size-3 text-muted group-hover:text-primary" />
                      {keyword.keyword}
                      <span className="text-[10px] text-muted">{keyword.weight.toFixed(1)}</span>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ai">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BrainCircuit className="size-4 text-primary" /> AI niche analysis
              </CardTitle>
              <CardDescription>
                Generated from permitted evidence for {detail.niche.name}. Statistics in
                the evidence stay separate from recommendations.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AiAdvisorForm
                fixedNiche
                nicheSlug={detail.niche.slug}
                initialType="niche_analysis"
                usage={usage}
              />
            </CardContent>
          </Card>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href={`/advisor?niche=${detail.niche.slug}`}>
                Open in AI advisor <ArrowUpRight className="size-3.5" />
              </Link>
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
  small,
}: {
  label: string;
  value: string;
  tone?: "primary" | "danger";
  small?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted">{label}</p>
      <p
        className={`mt-0.5 font-semibold tabular-nums ${small ? "text-xs" : "text-base"} ${
          tone === "danger" ? "text-danger" : tone === "primary" ? "text-primary" : "text-foreground"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/50 pb-2 last:border-0 last:pb-0">
      <span className="text-muted">{label}</span>
      <span className="max-w-[60%] text-right font-medium text-muted-strong">{value}</span>
    </div>
  );
}
