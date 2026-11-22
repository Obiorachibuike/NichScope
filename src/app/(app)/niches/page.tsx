import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Compass, Filter, SearchX, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { NicheCard } from "@/components/niche-card";
import { NicheFilters } from "@/components/niche-filters";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ComplianceNote } from "@/components/data-badges";
import { requireUser } from "@/lib/auth/session";
import { getReadyDb } from "@/lib/db/ready";
import { getEligibleMetricSourceIds, listCategories, listNiches, parseNicheFilters } from "@/lib/services/niches";
import { demoMode } from "@/lib/env";
import { nicheWatchlists } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const metadata: Metadata = { title: "Niche Explorer" };
export const dynamic = "force-dynamic";

export default async function NichesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser("/niches");
  const raw = await searchParams;
  const filters = parseNicheFilters(raw);
  const db = await getReadyDb();

  const [categories, result, savedRows, metricSources] = await Promise.all([
    listCategories(db),
    listNiches(db, filters),
    db
      .select({ nicheId: nicheWatchlists.nicheId, id: nicheWatchlists.id, slug: nicheWatchlists.nicheId })
      .from(nicheWatchlists)
      .where(eq(nicheWatchlists.userId, user.id)),
    getEligibleMetricSourceIds(db),
  ]);

  const savedMap = new Map(savedRows.map((row) => [row.nicheId, row.id]));
  const activeCategory = categories.find((c) => c.slug === filters.category);
  const paramsForLinks: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string") paramsForLinks[key] = value;
  }

  const statsAvailable = metricSources.length > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={
          <>
            <span>Research</span>
            <span className="text-border-strong">/</span>
            <span>Taxonomy explorer</span>
          </>
        }
        title="Niche Explorer"
        description="Search the full taxonomy and combine filters. Every facet queries real records; unavailable metrics produce honest empty results."
        actions={
          <>
            <Button asChild variant="secondary" size="sm">
              <Link href="/subniches">Sub-niches</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/advisor">
                <Sparkles className="size-4" /> AI advisor
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        <Suspense fallback={<Skeleton className="h-[600px] w-full" />}>
          <NicheFilters
            categories={categories.map((c) => ({ slug: c.slug, name: c.name }))}
            totalResults={result.total}
            statsAvailable={statsAvailable}
          />
        </Suspense>

        <section className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="normal-case">
              {result.total.toLocaleString()} niches
            </Badge>
            {activeCategory && (
              <Badge variant="secondary" className="normal-case">
                {activeCategory.name}
              </Badge>
            )}
            {filters.q && (
              <Badge variant="muted" className="normal-case normal-case">
                “{filters.q}”
              </Badge>
            )}
            {demoMode && (
              <Badge variant="warning" className="gap-1">
                Demo fixtures included
              </Badge>
            )}
            <div className="ml-auto flex items-center gap-2 text-xs text-muted">
              <Filter className="size-3.5" />
              Page {result.page} of {result.pageCount}
            </div>
          </div>

          {!statsAvailable && (
            <ComplianceNote>
              No eligible metrics source is active. Ranking filters and opportunity
              scores are hidden until a licensed provider is approved — taxonomy
              search and keyword discovery still work.
            </ComplianceNote>
          )}

          {result.items.length === 0 ? (
            <EmptyState
              icon={SearchX}
              title="No niches match these filters"
              description={
                filters.category || filters.q || filters.competition !== "all"
                  ? "Try removing a facet, broadening the keyword, or switching competition/growth to “Any”."
                  : "The taxonomy has not been seeded in this deployment yet."
              }
              action={
                <Button asChild variant="secondary" size="sm">
                  <Link href="/niches">
                    <Compass className="size-4" /> Reset filters
                  </Link>
                </Button>
              }
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {result.items.map((niche) => {
                const watchlistId = savedMap.get(niche.id);
                return (
                  <NicheCard
                    key={niche.id}
                    niche={{
                      id: niche.id,
                      slug: niche.slug,
                      name: niche.name,
                      description: niche.description,
                      categoryName: niche.categoryName,
                      categorySlug: niche.categorySlug,
                      opportunityScore: niche.opportunityScore,
                      growthTrend: niche.growthTrend,
                      competitionLevel: niche.competitionLevel,
                      monetizationPotential: niche.monetizationPotential,
                      dataConfidence: niche.dataConfidence,
                      formats: niche.formats,
                      avgViews: niche.avgViews,
                      isFixture: niche.isFixture,
                      sourceName: niche.sourceName,
                      childCount: niche.childCount,
                    }}
                    saved={Boolean(watchlistId)}
                    watchlistId={watchlistId}
                  />
                );
              })}
            </div>
          )}

          <Pagination
            page={result.page}
            pageCount={result.pageCount}
            basePath="/niches"
            params={paramsForLinks}
            className="pt-2"
          />
        </section>
      </div>
    </div>
  );
}
