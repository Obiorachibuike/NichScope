import type { Metadata } from "next";
import Link from "next/link";
import { Film, Search, PlaySquare } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { VideoCard } from "@/components/media-cards";
import { LiveLookupPanel } from "@/components/live-lookup-panel";
import { Pagination } from "@/components/ui/pagination";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ComplianceNote } from "@/components/data-badges";
import { requireUser } from "@/lib/auth/session";
import { getReadyDb } from "@/lib/db/ready";
import { searchVideos, videoSearchSchema } from "@/lib/services/research";
import { listCategories } from "@/lib/services/niches";
import { demoMode, youtubeConfigured } from "@/lib/env";

export const metadata: Metadata = { title: "Video Research" };
export const dynamic = "force-dynamic";

export default async function VideosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireUser("/videos");
  const raw = await searchParams;
  const flat: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string") flat[key] = value;
  }
  const filters = videoSearchSchema.parse(flat);
  const db = await getReadyDb();
  const [result, categories] = await Promise.all([
    searchVideos(db, filters),
    listCategories(db),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={
          <>
            <span>Research</span>
            <span className="text-border-strong">/</span>
            <span>Public video records</span>
          </>
        }
        title="Video Research"
        description="Explore stored public video metadata by format, niche, language and publication window. Every record links back to YouTube."
        actions={
          youtubeConfigured ? (
            <LiveLookupPanel type="video" />
          ) : (
            <Badge variant="muted" className="gap-1">
              <PlaySquare className="size-3" /> Live lookup disabled
            </Badge>
          )
        }
      />

      <form method="get" className="grid gap-2 rounded-xl border border-border bg-card p-3 sm:grid-cols-2 lg:grid-cols-6">
        <div className="relative sm:col-span-2">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <Input
            name="q"
            defaultValue={filters.q ?? ""}
            placeholder="Search video titles, channels or descriptions"
            className="pl-9"
            aria-label="Search videos"
          />
        </div>
        <select name="format" defaultValue={filters.format} aria-label="Format" className="h-10 rounded-lg border border-border bg-surface px-2 text-sm">
          <option value="all">All formats</option>
          <option value="shorts">Shorts</option>
          <option value="long_form">Long-form</option>
        </select>
        <select name="category" defaultValue={filters.category ?? ""} aria-label="Category" className="h-10 rounded-lg border border-border bg-surface px-2 text-sm">
          <option value="">Any category</option>
          {categories.map((category) => (
            <option key={category.slug} value={category.slug}>{category.name}</option>
          ))}
        </select>
        <select name="publishedWithin" defaultValue={filters.publishedWithin} aria-label="Published within" className="h-10 rounded-lg border border-border bg-surface px-2 text-sm">
          <option value="any">Any time</option>
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
          <option value="365">Last year</option>
        </select>
        <div className="flex gap-2">
          <select name="sort" defaultValue={filters.sort} aria-label="Sort" className="h-10 flex-1 rounded-lg border border-border bg-surface px-2 text-sm">
            <option value="recent">Newest</option>
            <option value="views">Most viewed</option>
            <option value="engagement">Most engaged</option>
            <option value="title">Title</option>
          </select>
          <Button type="submit">Go</Button>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:col-span-2">
          <Input name="language" defaultValue={filters.language ?? ""} placeholder="Language (en)" aria-label="Language" className="h-10" />
          <Input name="region" defaultValue={filters.region ?? ""} placeholder="Region (US)" maxLength={2} aria-label="Region" className="h-10" />
        </div>
      </form>

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="normal-case">
          {result.total.toLocaleString()} videos
        </Badge>
        {filters.q && <Badge variant="muted">“{filters.q}”</Badge>}
        {filters.format !== "all" && (
          <Badge variant="secondary" className="normal-case">
            {filters.format === "shorts" ? "Shorts" : "Long-form"}
          </Badge>
        )}
        {demoMode && <Badge variant="warning">Demo fixtures included</Badge>}
        <span className="ml-auto text-xs text-muted">
          Page {result.page} of {result.pageCount}
        </span>
      </div>

      {result.items.length === 0 ? (
        <EmptyState
          icon={Film}
          tone={youtubeConfigured ? "default" : "warning"}
          title="No videos stored"
          description={
            youtubeConfigured
              ? "No stored videos match these filters. Run a live lookup for a specific query."
              : "Video research requires the official YouTube Data API or a licensed source. Configure YOUTUBE_API_KEY to enable live lookups."
          }
          action={
            <Button asChild variant="secondary" size="sm">
              <Link href="/niches">Research a niche instead</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {result.items.map((video) => (
            <VideoCard key={video.videoId} video={video} />
          ))}
        </div>
      )}

      <Pagination page={result.page} pageCount={result.pageCount} basePath="/videos" params={flat} />

      <ComplianceNote>
        Shorts classification is estimated from duration because the YouTube Data API
        does not expose a Shorts flag. Public records are retained for at most 30 days
        and refreshed on schedule.
      </ComplianceNote>
    </div>
  );
}
