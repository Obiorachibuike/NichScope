import type { Metadata } from "next";
import Link from "next/link";
import { Network, Search } from "lucide-react";
import { eq } from "drizzle-orm";
import { PageHeader } from "@/components/page-header";
import { NicheCard } from "@/components/niche-card";
import { Pagination } from "@/components/ui/pagination";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { requireUser } from "@/lib/auth/session";
import { getReadyDb } from "@/lib/db/ready";
import { nicheWatchlists } from "@/lib/db/schema";
import { listCategories, listNiches, parseNicheFilters } from "@/lib/services/niches";

export const metadata: Metadata = { title: "Sub-niche Explorer" };
export const dynamic = "force-dynamic";

export default async function SubNichesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser("/subniches");
  const raw = await searchParams;
  const filters = parseNicheFilters({ ...raw, level: "sub" });
  const db = await getReadyDb();

  const [categories, result, savedRows] = await Promise.all([
    listCategories(db),
    listNiches(db, filters),
    db
      .select({ nicheId: nicheWatchlists.nicheId, id: nicheWatchlists.id })
      .from(nicheWatchlists)
      .where(eq(nicheWatchlists.userId, user.id)),
  ]);
  const savedMap = new Map(savedRows.map((row) => [row.nicheId, row.id]));
  const paramsForLinks: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string") paramsForLinks[key] = value;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={
          <>
            <span>Research</span>
            <span className="text-border-strong">/</span>
            <span>Second-level taxonomy</span>
          </>
        }
        title="Sub-Niche Explorer"
        description="Go one level deeper. Sub-niches are narrower content territories with clearer audience promises and less direct competition."
      />

      <form method="get" className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <Input
            name="q"
            defaultValue={filters.q ?? ""}
            placeholder="Search sub-niches or keywords"
            className="pl-9"
            aria-label="Search sub-niches"
          />
        </div>
        <select
          name="category"
          defaultValue={filters.category ?? ""}
          aria-label="Category"
          className="h-10 rounded-lg border border-border bg-surface px-3 text-sm text-foreground"
        >
          <option value="">All categories</option>
          {categories.map((category) => (
            <option key={category.slug} value={category.slug}>
              {category.name}
            </option>
          ))}
        </select>
        <select
          name="growth"
          defaultValue={filters.growth}
          aria-label="Growth"
          className="h-10 rounded-lg border border-border bg-surface px-3 text-sm text-foreground"
        >
          <option value="all">Any growth</option>
          <option value="fast_growing">Fast-growing</option>
          <option value="stable">Stable</option>
          <option value="declining">Declining</option>
          <option value="unknown">Unknown</option>
        </select>
        <Button type="submit">Apply</Button>
      </form>

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="normal-case">
          {result.total.toLocaleString()} sub-niches
        </Badge>
        {filters.q && <Badge variant="muted">“{filters.q}”</Badge>}
        <span className="ml-auto text-xs text-muted">
          Page {result.page} of {result.pageCount}
        </span>
      </div>

      {result.items.length === 0 ? (
        <EmptyState
          icon={Network}
          title="No sub-niches match"
          description="Try clearing the search or choosing a different category."
          action={
            <Button asChild variant="secondary" size="sm">
              <Link href="/subniches">Reset</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {result.items.map((niche) => (
            <div key={niche.id} className="space-y-1.5">
              {niche.parentName && (
                <p className="px-1 text-[11px] text-muted">
                  in{" "}
                  <Link href={`/niches/${niche.parentSlug}`} className="font-medium text-secondary hover:underline">
                    {niche.parentName}
                  </Link>{" "}
                  · {niche.categoryName}
                </p>
              )}
              <NicheCard
                niche={niche}
                saved={savedMap.has(niche.id)}
                watchlistId={savedMap.get(niche.id)}
              />
            </div>
          ))}
        </div>
      )}

      <Pagination
        page={result.page}
        pageCount={result.pageCount}
        basePath="/subniches"
        params={paramsForLinks}
      />
    </div>
  );
}
