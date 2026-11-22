import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Eye,
  ExternalLink,
  Globe2,
  Users,
  Video,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { VideoCard } from "@/components/media-cards";
import { DemoBadge, SourceBadge, ComplianceNote } from "@/components/data-badges";
import { requireUser } from "@/lib/auth/session";
import { getReadyDb } from "@/lib/db/ready";
import { getChannelDetail } from "@/lib/services/research";
import { formatDate, formatNumber, formatRelativeTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Channel research" };
}

export default async function ChannelDetailPage({
  params,
}: {
  params: Promise<{ channelId: string }>;
}) {
  await requireUser("/channels");
  const { channelId } = await params;
  const db = await getReadyDb();
  const detail = await getChannelDetail(db, decodeURIComponent(channelId));
  if (!detail) notFound();

  const { channel } = detail;
  const externalUrl = channel.isFixture
    ? `https://www.youtube.com/results?search_query=${encodeURIComponent(channel.title)}`
    : `https://www.youtube.com/channel/${channel.channelId}`;

  return (
    <div className="space-y-6">
      <Link href="/channels" className="flex items-center gap-1 text-xs text-muted hover:text-foreground">
        <ArrowLeft className="size-3" /> Channel Intelligence
      </Link>

      <PageHeader
        eyebrow={
          <div className="flex flex-wrap items-center gap-2">
            <SourceBadge sourceName={detail.sourceName} isFixture={channel.isFixture} />
            {channel.isFixture && <DemoBadge />}
            <Badge variant="outline" className="normal-case">
              Retrieved {formatRelativeTime(channel.fetchedAt)}
            </Badge>
          </div>
        }
        title={channel.title}
        description={channel.description ?? "No channel description was provided by the source."}
        actions={
          <>
            <Button asChild variant="secondary" size="sm">
              <a href={externalUrl} target="_blank" rel="noreferrer noopener">
                <ExternalLink className="size-4" /> Open on YouTube
              </a>
            </Button>
            {detail.nicheSlug && (
              <Button asChild size="sm" variant="outline">
                <Link href={`/niches/${detail.nicheSlug}`}>Niche: {detail.nicheName}</Link>
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Subscribers"
          value={channel.hiddenSubscriberCount ? "Hidden" : formatNumber(channel.subscriberCount)}
          hint={channel.hiddenSubscriberCount ? "The channel hides this count" : "Public count from YouTube"}
          icon={Users}
        />
        <StatCard label="Total views" value={formatNumber(channel.viewCount)} icon={Eye} />
        <StatCard label="Videos" value={formatNumber(channel.videoCount)} icon={Video} />
        <StatCard
          label="Country"
          value={channel.country ?? "Not provided"}
          hint="Country is only shown when the source supplies it"
          icon={Globe2}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <Card>
          <CardHeader>
            <CardTitle>Recent stored videos</CardTitle>
          </CardHeader>
          <CardContent>
            {detail.videos.length === 0 ? (
              <EmptyState
                icon={Video}
                title="No recent videos stored"
                description="Run a live video lookup for this channel's niche, or use the YouTube data API lookup to store public videos."
              />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {detail.videos.map((video) => (
                  <VideoCard
                    key={video.id}
                    video={{ ...video, sourceName: detail.sourceName }}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Channel record</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5 text-xs">
            <Row label="Channel ID" value={channel.channelId} mono />
            <Row label="Created" value={formatDate(channel.publishedAt)} />
            <Row label="Source" value={detail.sourceName} />
            <Row label="Retrieved" value={formatDate(channel.fetchedAt)} />
            <Row label="Refresh due" value={formatDate(channel.refreshDueAt)} />
            <ComplianceNote>
              These are the channel's own public statistics as returned by the YouTube
              Data API. NicheScope does not derive cross-channel metrics from them.
              Records are deleted after the 30-day retention window.
            </ComplianceNote>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-2 border-b border-border/50 pb-2 last:border-0 last:pb-0">
      <span className="text-muted">{label}</span>
      <span className={`max-w-[60%] break-all text-right font-medium text-muted-strong ${mono ? "font-mono text-[11px]" : ""}`}>
        {value}
      </span>
    </div>
  );
}
