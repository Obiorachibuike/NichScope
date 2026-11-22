import type { Metadata } from "next";
import Link from "next/link";
import { Search, Tv, PlaySquare } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { ChannelCard } from "@/components/media-cards";
import { LiveLookupPanel } from "@/components/live-lookup-panel";
import { Pagination } from "@/components/ui/pagination";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ComplianceNote } from "@/components/data-badges";
import { requireUser } from "@/lib/auth/session";
import { getReadyDb } from "@/lib/db/ready";
import { channelSearchSchema, searchChannels } from "@/lib/services/research";
import { demoMode, youtubeConfigured } from "@/lib/env";

export const metadata: Metadata = { title: "Channel Intelligence" };
export const dynamic = "force-dynamic";

export default async function ChannelsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireUser("/channels");
  const raw = await searchParams;
  const flat: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string") flat[key] = value;
  }
  const filters = channelSearchSchema.parse(flat);
  const db = await getReadyDb();
  const result = await searchChannels(db, filters);

  const paramsForLinks: Record<string, string | undefined> = { ...flat };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={
          <>
            <span>Research</span>
            <span className="text-border-strong">/</span>
            <span>Individual channels</span>
          </>
        }
        title="Channel Intelligence"
        description="Research individual YouTube channels with attributed public metadata. Statistics are never blended across channels."
        actions={
          youtubeConfigured ? (
            <LiveLookupPanel type="channel" />
          ) : (
            <Badge variant="muted" className="gap-1">
              <PlaySquare className="size-3" /> Live lookup disabled
            </Badge>
          )
        }
      />

      <form method="get" className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <Input
            name="q"
            defaultValue={filters.q ?? ""}
            placeholder="Channel name, channel ID or niche keyword"
            className="pl-9"
            aria-label="Search channels"
          />
        </div>
        <select
          name="country"
          defaultValue={filters.country ?? ""}
          aria-label="Country"
          className="h-10 rounded-lg border border-border bg-surface px-3 text-sm"
        >
          <option value="">Any country</option>
          <option value="US">United States</option>
          <option value="GB">United Kingdom</option>
          <option value="CA">Canada</option>
          <option value="NG">Nigeria</option>
          <option value="IN">India</option>
          <option value="DE">Germany</option>
        </select>
        <select
          name="sort"
          defaultValue={filters.sort}
          aria-label="Sort"
          className="h-10 rounded-lg border border-border bg-surface px-3 text-sm"
        >
          <option value="subscribers">Most subscribers</option>
          <option value="views">Most views</option>
          <option value="videos">Most videos</option>
          <option value="recent">Newest</option>
          <option value="name">Name</option>
        </select>
        <Button type="submit">Search</Button>
      </form>

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="normal-case">
          {result.total.toLocaleString()} channels
        </Badge>
        {filters.q && <Badge variant="muted">“{filters.q}”</Badge>}
        {demoMode && <Badge variant="warning">Demo fixtures included</Badge>}
        <span className="ml-auto text-xs text-muted">
          Page {result.page} of {result.pageCount}
        </span>
      </div>

      {result.items.length === 0 ? (
        <EmptyState
          icon={Tv}
          tone={youtubeConfigured ? "default" : "warning"}
          title="No channels found"
          description={
            youtubeConfigured
              ? "No stored records match. Use “Fetch live channels” to search the YouTube Data API for a specific query."
              : "Configure YOUTUBE_API_KEY to research live channels. Individual channel records will then be stored with attribution and a 30-day retention limit."
          }
          action={
            !youtubeConfigured ? (
              <Button asChild variant="secondary" size="sm">
                <Link href="/trends">View data source status</Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {result.items.map((channel) => (
            <ChannelCard key={channel.channelId} channel={channel} />
          ))}
        </div>
      )}

      <Pagination page={result.page} pageCount={result.pageCount} basePath="/channels" params={paramsForLinks} />

      <ComplianceNote>
        YouTube API Services Terms require attribution, periodic refresh and deletion of
        stored public data. NicheScope retains these records for at most 30 days and
        displays the retrieval timestamp on each one. Channel statistics are the
        channel's own public counts, not a cross-channel derived metric.
      </ComplianceNote>
    </div>
  );
}
