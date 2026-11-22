import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowUpRight,
  Compass,
  FlaskConical,
  Globe2,
  Info,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { z } from "zod";
import { PageHeader } from "@/components/page-header";
import { RankingTable } from "@/components/ranking-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ComplianceNote } from "@/components/data-badges";
import { requireUser } from "@/lib/auth/session";
import { getReadyDb } from "@/lib/db/ready";
import { getTrends } from "@/lib/services/trends";
import { getSourceStatuses } from "@/lib/services/dashboard";
import { titleCase } from "@/lib/utils";
import { demoMode } from "@/lib/env";

export const metadata: Metadata = { title: "Global Trends" };
export const dynamic = "force-dynamic";

const paramsSchema = z.object({
  period: z.enum(["7d", "30d", "90d"]).catch("30d"),
  country: z.string().trim().max(2).optional(),
});

export default async function TrendsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireUser("/trends");
  const raw = await searchParams;
  const flat: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string") flat[key] = value;
  }
  const params = paramsSchema.parse(flat);
  const db = await getReadyDb();
  const [trends, sources] = await Promise.all([
    getTrends(db, { period: params.period, limit: 10 }),
    getSourceStatuses(db),
  ]);

  const hasAnyRanking = trends.groups.some((group) => group.items.length > 0);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={
          <>
            <span>Discover</span>
            <span className="text-border-strong">/</span>
            <span>Global rankings</span>
          </>
        }
        title="Global Trends"
        description="Global niche cohorts built only from eligible sources. Country and language controls inform live searches — they do not imply geographic popularity."
        actions={
          <form method="get" className="flex items-center gap-2">
            <select
              name="period"
              defaultValue={params.period}
              aria-label="Ranking period"
              className="h-9 rounded-lg border border-border bg-surface px-2 text-sm"
            >
              <option value="7d">7 days</option>
              <option value="30d">30 days</option>
              <option value="90d">90 days</option>
            </select>
            {trends.regions.length > 0 && (
              <select
                name="country"
                defaultValue={params.country ?? ""}
                aria-label="Region"
                className="h-9 rounded-lg border border-border bg-surface px-2 text-sm"
              >
                <option value="">All regions</option>
                {trends.regions.map((region) => (
                  <option key={region.code} value={region.code}>
                    {region.name}
                  </option>
                ))}
              </select>
            )}
            <Button type="submit" size="sm">Apply</Button>
          </form>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="normal-case">
          <Globe2 className="size-3" /> Global scope
        </Badge>
        <Badge variant="muted" className="normal-case">
          {params.period} window
        </Badge>
        {trends.regionSource === "youtube_api" && (
          <Badge variant="success" className="normal-case">
            {trends.regions.length} supported regions loaded from YouTube
          </Badge>
        )}
        {demoMode && <Badge variant="warning">Demo fixtures</Badge>}
        <Button asChild variant="ghost" size="sm" className="ml-auto">
          <Link href="/niches">
            <Compass className="size-3.5" /> Explore all niches
          </Link>
        </Button>
      </div>

      {!hasAnyRanking && (
        <Card>
          <CardContent className="pt-5">
            <ComplianceNote>
              No ranking group has an eligible source in this deployment. This page shows
              an explicit empty state rather than fabricated trends. Approve a licensed
              analytics provider (or obtain written YouTube approval) to publish rankings.
            </ComplianceNote>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        {trends.groups.map((group) => (
          <Card key={group.category} className={group.items.length === 0 ? "opacity-90" : ""}>
            <CardHeader className="flex-row items-start justify-between gap-2">
              <div>
                <CardTitle className="flex items-center gap-2">
                  {group.category === "declining" ? (
                    <TrendingDown className="size-4 text-danger" />
                  ) : group.category === "emerging" ? (
                    <FlaskConical className="size-4 text-warning" />
                  ) : (
                    <TrendingUp className="size-4 text-primary" />
                  )}
                  {group.label}
                </CardTitle>
                <CardDescription>{group.description}</CardDescription>
              </div>
              <Badge variant="outline">{group.items.length}</Badge>
            </CardHeader>
            <CardContent>
              <RankingTable
                compact
                rows={group.items}
                emptyMessage="No eligible source for this cohort yet."
              />
              <div className="mt-3 flex items-center justify-between">
                <span className="text-[10px] text-muted">
                  {group.items[0]?.sourceName
                    ? `Source: ${group.items[0].sourceName}`
                    : "No source"}
                  {group.items[0]?.isFixture ? " · demo fixture" : ""}
                </span>
                <Link
                  href={`/niches?sort=opportunity&period=${params.period}`}
                  className="flex items-center gap-1 text-[10px] font-medium text-primary hover:underline"
                >
                  Explore <ArrowUpRight className="size-3" />
                </Link>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Info className="size-4 text-muted" /> Data source status
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {sources.map((source) => (
            <div key={source.key} className="rounded-lg border border-border/70 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-muted-strong">{source.name}</p>
                <Badge
                  variant={
                    source.operational
                      ? "success"
                      : source.status === "pending_approval"
                        ? "warning"
                        : "muted"
                  }
                >
                  {source.operational ? "operational" : source.status.replace("_", " ")}
                </Badge>
              </div>
              <p className="mt-1 text-[10px] text-muted">
                {titleCase(source.type)}
                {source.retentionDays ? ` · ${source.retentionDays}-day retention` : ""}
                {source.permitsCrossChannelAggregation
                  ? " · cross-channel aggregation permitted"
                  : " · no cross-channel aggregation"}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="space-y-2">
        {trends.notes.map((note) => (
          <p key={note} className="flex items-start gap-2 text-[11px] leading-relaxed text-muted">
            <Info className="mt-0.5 size-3 shrink-0" /> {note}
          </p>
        ))}
      </div>
    </div>
  );
}
