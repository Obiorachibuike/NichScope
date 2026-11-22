import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import {
  Activity,
  ArrowUpRight,
  Bell,
  Bookmark,
  BrainCircuit,
  Compass,
  Database,
  FlaskConical,
  Gauge,
  Layers,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { z } from "zod";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { RankingTable } from "@/components/ranking-table";
import { OpportunityBars } from "@/components/charts";
import { DashboardControls } from "@/components/dashboard-controls";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Freshness, ComplianceNote } from "@/components/data-badges";
import { ScoreBar } from "@/components/score-bar";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/auth/session";
import { getReadyDb } from "@/lib/db/ready";
import { getDashboardData } from "@/lib/services/dashboard";
import { demoMode } from "@/lib/env";
import {
  formatNumber,
  formatRelativeTime,
  titleCase,
} from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

const paramsSchema = z.object({
  category: z
    .enum([
      "top_performing",
      "highest_growth",
      "opportunity",
      "low_competition",
      "emerging",
      "declining",
    ])
    .catch("opportunity"),
  period: z.enum(["7d", "30d", "90d"]).catch("30d"),
  limit: z.coerce.number().int().min(5).max(100).catch(10),
});

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser("/dashboard");
  const raw = await searchParams;
  const flat: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string") flat[key] = value;
  }
  const params = paramsSchema.parse(flat);
  const db = await getReadyDb();
  const data = await getDashboardData(db, user.id, params);
  const firstName = (user.name ?? user.email).split(" ")[0];

  const hasRankings = data.rankings.length > 0;
  const rankingChart = data.rankings
    .slice(0, 8)
    .map((row) => ({ name: row.name, score: Math.round(row.score) }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={
          <>
            <span>Dashboard</span>
            <span className="text-border-strong">/</span>
            <span>30-day intelligence</span>
          </>
        }
        title={`Welcome back, ${firstName}`}
        description="Your niche research command centre. Rankings only appear when an approved data source supports them."
        actions={
          <>
            <Button asChild variant="secondary" size="sm">
              <Link href="/niches">
                <Compass className="size-4" /> Explore niches
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/advisor">
                <Sparkles className="size-4" /> AI advisor
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Mapped niches"
          value={formatNumber(data.stats.niches)}
          hint={`${data.stats.categories} categories in the taxonomy`}
          icon={Layers}
        />
        <StatCard
          label="Watchlist"
          value={formatNumber(data.stats.watched)}
          hint="Niches you are monitoring"
          icon={Bookmark}
        />
        <StatCard
          label="AI reports"
          value={formatNumber(data.stats.reports)}
          hint={`${data.stats.savedSearches} saved searches`}
          icon={BrainCircuit}
        />
        <StatCard
          label="YouTube quota"
          value={
            data.quota.configured
              ? `${data.quota.percentUsed.toFixed(0)}%`
              : "Not set"
          }
          hint={
            data.quota.configured
              ? `${formatNumber(data.quota.used)} / ${formatNumber(data.quota.limit)} units today`
              : "Set YOUTUBE_API_KEY for live research"
          }
          icon={Gauge}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="size-4 text-primary" />
                  Top niches
                </CardTitle>
                <CardDescription>
                  {data.rankings.length > 0
                    ? `${data.rankings.length} niches · ${data.rankingPeriod} window · source ${data.rankings[0]?.sourceName}`
                    : "No eligible ranking source is available yet."}
                </CardDescription>
              </div>
              <Button asChild variant="ghost" size="sm">
                <Link href="/trends">
                  All trends <ArrowUpRight className="size-3.5" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <Suspense fallback={<Skeleton className="h-20 w-full" />}>
                <DashboardControls
                  category={params.category}
                  period={params.period}
                  limit={params.limit}
                />
              </Suspense>
              <RankingTable
                rows={data.rankings.map((row) => ({
                  nicheId: row.nicheId,
                  slug: row.slug,
                  name: row.name,
                  categoryName: row.categoryName,
                  rank: row.rank,
                  score: row.score,
                  metrics: row.metrics,
                  isFixture: row.isFixture,
                  sourceName: row.sourceName,
                  sourceKey: row.sourceKey,
                }))}
                emptyMessage={
                  demoMode
                    ? "Run the rankings job or reload the seed to populate demo rankings."
                    : "No approved data source can produce this ranking. Connect a licensed analytics provider or request YouTube aggregation approval."
                }
              />
              {!hasRankings && (
                <ComplianceNote>
                  NicheScope never fills an empty ranking with invented values. Live
                  taxonomy discovery remains available while ranking eligibility is
                  pending.
                </ComplianceNote>
              )}
            </CardContent>
          </Card>

          {rankingChart.length > 0 && (
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Opportunity distribution</CardTitle>
                  <CardDescription>
                    Composite score of the current top {rankingChart.length}.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <OpportunityBars data={rankingChart} height={280} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FlaskConical className="size-4 text-warning" /> Emerging niches
                  </CardTitle>
                  <CardDescription>
                    Growth with comparatively low competition in the 30-day window.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {data.emerging.length === 0 ? (
                    <EmptyState
                      icon={TrendingUp}
                      title="No emerging cohorts yet"
                      description="Emerging niches require growth and competition metrics from an eligible source."
                    />
                  ) : (
                    <ul className="space-y-3">
                      {data.emerging.map((item) => (
                        <li key={item.nicheId} className="flex items-center gap-3">
                          <span className="w-4 text-xs font-semibold tabular-nums text-muted">
                            {item.rank}
                          </span>
                          <div className="min-w-0 flex-1">
                            <Link
                              href={`/niches/${item.slug}`}
                              className="block truncate text-sm font-medium hover:text-primary"
                            >
                              {item.name}
                            </Link>
                            <p className="text-[11px] text-muted">{item.categoryName}</p>
                          </div>
                          <div className="w-24">
                            <ScoreBar score={item.score} size="sm" />
                          </div>
                          {item.isFixture && (
                            <span title="Demo fixture">
                              <FlaskConical className="size-3.5 text-warning" />
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader className="flex-row items-start justify-between">
                <div>
                  <CardTitle>Recent AI research</CardTitle>
                  <CardDescription>Your latest evidence-grounded reports.</CardDescription>
                </div>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/advisor">
                    <Sparkles className="size-3.5" />
                  </Link>
                </Button>
              </CardHeader>
              <CardContent>
                {data.reports.length === 0 ? (
                  <EmptyState
                    icon={BrainCircuit}
                    title="No AI reports yet"
                    description="Open a niche and generate an analysis to see it here."
                    action={
                      <Button asChild size="sm" variant="secondary">
                        <Link href="/advisor">Generate a report</Link>
                      </Button>
                    }
                  />
                ) : (
                  <ul className="divide-y divide-border/70">
                    {data.reports.map((report) => (
                      <li key={report.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                        <span className="flex size-8 items-center justify-center rounded-lg bg-card-elevated text-muted">
                          <BrainCircuit className="size-3.5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <Link
                            href={`/advisor?report=${report.id}`}
                            className="block truncate text-sm font-medium hover:text-primary"
                          >
                            {report.title}
                          </Link>
                          <p className="text-[11px] text-muted">
                            {formatRelativeTime(report.createdAt)} · {report.provider}
                            {report.isFallback ? " (fallback)" : ""}
                          </p>
                        </div>
                        <Badge
                          variant={
                            report.status === "completed"
                              ? "success"
                              : report.status === "failed"
                                ? "danger"
                                : "muted"
                          }
                        >
                          {report.status}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recently explored</CardTitle>
                <CardDescription>Niches you opened during research.</CardDescription>
              </CardHeader>
              <CardContent>
                {data.recentViews.length === 0 ? (
                  <EmptyState
                    icon={Compass}
                    title="Nothing explored yet"
                    description="Niche pages you visit appear here for quick return."
                  />
                ) : (
                  <ul className="space-y-2.5">
                    {data.recentViews.map((view) => (
                      <li key={view.nicheId ?? view.slug}>
                        <Link
                          href={`/niches/${view.slug}`}
                          className="flex items-center justify-between gap-3 rounded-lg border border-border/70 px-3 py-2 hover:border-border-strong hover:bg-card-elevated/50"
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium">
                              {view.name}
                            </span>
                            <span className="block text-[11px] text-muted">
                              {view.categoryName}
                            </span>
                          </span>
                          <span className="shrink-0 text-[11px] text-muted">
                            {formatRelativeTime(view.viewedAt)}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        <aside className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <RefreshCw className="size-3.5 text-muted" /> Data freshness
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              <Freshness label="Rankings calculated" date={data.freshness.rankingsAt} isDemo={demoMode} />
              <Freshness label="Channel metadata" date={data.freshness.channelsAt} isDemo={demoMode} />
              <Freshness label="Video metadata" date={data.freshness.videosAt} isDemo={demoMode} />
              <Freshness label="Last retention purge" date={data.freshness.lastRetentionPurgeAt} />
              <div className="mt-3 rounded-lg border border-border bg-surface px-3 py-2 text-[11px] leading-relaxed text-muted">
                Public YouTube data is retained for at most{" "}
                <strong className="text-muted-strong">{data.freshness.retentionDays} days</strong> and refreshed on
                a schedule. Demo fixtures are excluded from retention.
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Database className="size-3.5 text-muted" /> Data sources
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.sources.map((source) => (
                <div key={source.key} className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-muted-strong">
                      {source.name}
                    </p>
                    <p className="text-[10px] text-muted">
                      {titleCase(source.type)}
                      {source.retentionDays ? ` · ${source.retentionDays}d retention` : ""}
                    </p>
                  </div>
                  <Badge
                    variant={
                      source.status === "active" && source.operational
                        ? "success"
                        : source.status === "pending_approval"
                          ? "warning"
                          : "muted"
                    }
                  >
                    {source.status === "active" && source.operational
                      ? "operational"
                      : source.status.replace("_", " ")}
                  </Badge>
                </div>
              ))}
              {user.role === "admin" && (
                <Button asChild variant="outline" size="sm" className="mt-2 w-full">
                  <Link href="/admin?tab=compliance">
                    <ShieldCheck className="size-3.5" /> Governance
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>

          {data.quota.configured && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Activity className="size-3.5 text-muted" /> YouTube quota
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <ScoreBar score={data.quota.percentUsed} showLabel={false} />
                <div className="flex justify-between text-[11px] text-muted">
                  <span>{formatNumber(data.quota.used)} used</span>
                  <span>{formatNumber(data.quota.remaining)} remaining</span>
                </div>
                <p className="text-[10px] text-muted">
                  {data.quota.cacheHits} cache hits saved quota today.
                </p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Bookmark className="size-3.5 text-muted" /> Saved niches
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.saved.length === 0 ? (
                <p className="text-xs text-muted">
                  No saved niches yet.{" "}
                  <Link href="/niches" className="text-primary hover:underline">
                    Browse the explorer
                  </Link>
                  .
                </p>
              ) : (
                <ul className="space-y-2">
                  {data.saved.map((item) => (
                    <li key={item.watchlistId}>
                      <Link
                        href={`/niches/${item.slug}`}
                        className="flex items-center justify-between gap-2 text-xs"
                      >
                        <span className="truncate font-medium text-muted-strong hover:text-foreground">
                          {item.name}
                        </span>
                        <span className="shrink-0 text-[10px] text-muted">
                          {item.opportunityScore === null
                            ? "—"
                            : `${item.opportunityScore.toFixed(0)}/100`}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              <Button asChild variant="ghost" size="sm" className="mt-3 w-full justify-between">
                <Link href="/saved">
                  Open watchlist <ArrowUpRight className="size-3.5" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          {data.alerts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Bell className="size-3.5 text-muted" /> Alerts
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5">
                {data.alerts.map((alert) => (
                  <div key={alert.id} className="rounded-lg border border-border/70 p-2.5">
                    <p className="text-[11px] leading-relaxed text-muted-strong">
                      {alert.message}
                    </p>
                    <p className="mt-1 text-[10px] text-muted">
                      {formatRelativeTime(alert.createdAt)}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}
