import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Clock, Search, Tag } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ChannelCard, VideoCard } from "@/components/media-cards";
import { ScoreBar } from "@/components/score-bar";
import { requireUser } from "@/lib/auth/session";
import { getReadyDb } from "@/lib/db/ready";
import { getSearchHistory, globalSearch, recordSearch } from "@/lib/services/dashboard";

export const metadata: Metadata = { title: "Search" };
export const dynamic = "force-dynamic";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser("/search");
  const raw = await searchParams;
  const q = typeof raw.q === "string" ? raw.q.trim() : "";
  const db = await getReadyDb();
  const [results, history] = await Promise.all([
    q.length >= 2 ? globalSearch(db, q) : Promise.resolve(null),
    getSearchHistory(db, user.id, 6),
  ]);
  if (q.length >= 2) await recordSearch(db, user.id, q);
  const total = results
    ? results.niches.length + results.categories.length + results.channels.length + results.videos.length
    : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={
          <>
            <span>Workspace</span>
            <span className="text-border-strong">/</span>
            <span>Cross-entity search</span>
          </>
        }
        title={q ? `Results for “${q}”` : "Search"}
        description="Search niches, keywords, categories, channels and videos in one place."
      />

      <form method="get" className="flex gap-2 rounded-xl border border-border bg-card p-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <Input
            name="q"
            defaultValue={q}
            placeholder="Search NicheScope…"
            className="pl-9"
            aria-label="Search"
            autoFocus
          />
        </div>
        <Button type="submit">Search</Button>
      </form>

      {!results ? (
        <div className="space-y-4">
          {history.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Recent searches</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {history.map((term) => (
                  <Link
                    key={term}
                    href={`/search?q=${encodeURIComponent(term)}`}
                    className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-muted-strong hover:border-primary/40 hover:text-primary"
                  >
                    <Clock className="size-3 text-muted" /> {term}
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}
          <EmptyState
            icon={Search}
            title="Start typing to search"
            description="Use at least 2 characters. Try a niche, a keyword, an alias, a channel name or a category."
          />
        </div>
      ) : total === 0 ? (
        <EmptyState
          icon={Search}
          tone="warning"
          title={`No results for “${results.query}”`}
          description="Check the spelling, try a broader keyword, or browse the Niche Explorer."
          action={
            <Button asChild size="sm" variant="secondary">
              <Link href="/niches">Browse niches</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-6">
          {results.categories.length > 0 && (
            <section>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                Categories
              </h2>
              <div className="flex flex-wrap gap-2">
                {results.categories.map((category) => (
                  <Link
                    key={category.slug}
                    href={`/niches?category=${category.slug}`}
                    className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs hover:border-primary/40 hover:text-primary"
                  >
                    <Tag className="size-3" /> {category.name}
                  </Link>
                ))}
              </div>
            </section>
          )}

          {results.niches.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Niches</CardTitle>
              </CardHeader>
              <CardContent className="divide-y divide-border/60">
                {results.niches.map((niche) => (
                  <div key={niche.slug} className="flex flex-wrap items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                    <div className="min-w-0 flex-1">
                      <Link href={`/niches/${niche.slug}`} className="flex items-center gap-1 text-sm font-medium hover:text-primary">
                        {niche.name} <ArrowRight className="size-3" />
                      </Link>
                      <p className="truncate text-[11px] text-muted">
                        {niche.categoryName} · {niche.description ?? "No description"}
                      </p>
                    </div>
                    <div className="w-28">
                      <ScoreBar score={niche.opportunityScore} size="sm" showLabel={false} />
                    </div>
                    <Badge variant="outline" className="normal-case">
                      {niche.opportunityScore === null ? "unscored" : `${niche.opportunityScore.toFixed(0)}/100`}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {results.channels.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Channels</h2>
              <div className="grid gap-3 xl:grid-cols-2">
                {results.channels.map((channel) => (
                  <ChannelCard key={channel.channelId} channel={channel} />
                ))}
              </div>
            </section>
          )}

          {results.videos.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Videos</h2>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {results.videos.map((video) => (
                  <VideoCard key={video.videoId} video={video} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
