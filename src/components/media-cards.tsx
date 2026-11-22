import Link from "next/link";
import {
  ArrowUpRight,
  Clock,
  Eye,
  MessageSquare,
  ThumbsUp,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DemoBadge, SourceBadge } from "@/components/data-badges";
import { formatDate, formatDuration, formatNumber, formatRelativeTime } from "@/lib/utils";

function PlaceholderThumb({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  const initials = label
    .split(" ")
    .map((word) => word[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div
      className={`flex items-center justify-center bg-gradient-to-br from-primary/15 via-card-elevated to-secondary/15 ${className ?? ""}`}
      aria-hidden="true"
    >
      <span className="text-sm font-semibold tracking-wide text-muted-strong">
        {initials || "NS"}
      </span>
    </div>
  );
}

export interface ChannelCardData {
  channelId: string;
  title: string;
  description: string | null;
  thumbnailUrl: string | null;
  country: string | null;
  subscriberCount: number | null;
  viewCount: number | null;
  videoCount: number | null;
  fetchedAt: Date | string;
  sourceName?: string;
  isFixture: boolean;
}

export function ChannelCard({ channel }: { channel: ChannelCardData }) {
  const href = channel.isFixture
    ? `https://www.youtube.com/results?search_query=${encodeURIComponent(channel.title)}`
    : `https://www.youtube.com/channel/${channel.channelId}`;
  return (
    <article className="card-hover flex gap-3 rounded-xl border border-border bg-card p-4">
      {channel.thumbnailUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={channel.thumbnailUrl}
          alt=""
          width={48}
          height={48}
          loading="lazy"
          className="size-12 shrink-0 rounded-full border border-border object-cover"
        />
      ) : (
        <PlaceholderThumb label={channel.title} className="size-12 shrink-0 rounded-full border border-border" />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Link href={`/channels/${encodeURIComponent(channel.channelId)}`} className="block truncate text-sm font-semibold hover:text-primary">
              {channel.title}
            </Link>
            <p className="text-[11px] text-muted">
              {channel.country ?? "Country not provided"}
            </p>
          </div>
          <a
            href={href}
            target="_blank"
            rel="noreferrer noopener"
            className="flex shrink-0 items-center gap-1 text-[11px] font-medium text-primary hover:underline"
          >
            YouTube <ArrowUpRight className="size-3" />
          </a>
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">
          <span className="flex items-center gap-1">
            <Users className="size-3" /> {formatNumber(channel.subscriberCount)}
          </span>
          <span className="flex items-center gap-1">
            <Eye className="size-3" /> {formatNumber(channel.viewCount)}
          </span>
          <span>{formatNumber(channel.videoCount)} videos</span>
        </div>
        {channel.description && (
          <p className="mt-2 line-clamp-2 text-[11px] leading-relaxed text-muted">
            {channel.description}
          </p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <SourceBadge sourceName={channel.sourceName} isFixture={channel.isFixture} />
          {channel.isFixture && <DemoBadge />}
          <span className="text-[10px] text-muted">
            Retrieved {formatRelativeTime(channel.fetchedAt)}
          </span>
        </div>
      </div>
    </article>
  );
}

export interface VideoCardData {
  videoId: string;
  title: string;
  channelTitle: string | null;
  channelId: string | null;
  thumbnailUrl: string | null;
  publishedAt: Date | string | null;
  durationSeconds: number | null;
  viewCount: number | null;
  likeCount: number | null;
  commentCount: number | null;
  format: string;
  nicheName?: string | null;
  nicheSlug?: string | null;
  defaultLanguage?: string | null;
  sourceName?: string;
  isFixture: boolean;
  fetchedAt: Date | string;
}

export function VideoCard({ video }: { video: VideoCardData }) {
  const href = video.isFixture
    ? `https://www.youtube.com/results?search_query=${encodeURIComponent(video.title)}`
    : `https://www.youtube.com/watch?v=${video.videoId}`;
  return (
    <article className="card-hover group overflow-hidden rounded-xl border border-border bg-card">
      <div className="relative aspect-video w-full overflow-hidden bg-card-elevated">
        {video.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={video.thumbnailUrl}
            alt=""
            loading="lazy"
            className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <PlaceholderThumb label={video.title} className="size-full" />
        )}
        <span className="absolute bottom-1.5 right-1.5 rounded bg-black/75 px-1.5 py-0.5 font-mono text-[10px] text-white">
          {formatDuration(video.durationSeconds)}
        </span>
        <span className="absolute left-1.5 top-1.5">
          <Badge variant={video.format === "shorts" ? "secondary" : "muted"} className="bg-background/80 backdrop-blur">
            {video.format === "shorts" ? "Shorts" : video.format === "long_form" ? "Long-form" : "Unknown"}
          </Badge>
        </span>
      </div>
      <div className="space-y-2 p-3.5">
        <a
          href={href}
          target="_blank"
          rel="noreferrer noopener"
          className="line-clamp-2 text-sm font-medium leading-snug hover:text-primary"
        >
          {video.title}
        </a>
        <p className="text-[11px] text-muted">
          {video.channelTitle ?? "Unknown channel"} · {formatDate(video.publishedAt)}
        </p>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted">
          <span className="flex items-center gap-1">
            <Eye className="size-3" /> {formatNumber(video.viewCount)}
          </span>
          <span className="flex items-center gap-1">
            <ThumbsUp className="size-3" /> {formatNumber(video.likeCount)}
          </span>
          <span className="flex items-center gap-1">
            <MessageSquare className="size-3" /> {formatNumber(video.commentCount)}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="size-3" /> {formatRelativeTime(video.fetchedAt)}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 border-t border-border/60 pt-2">
          {video.nicheSlug ? (
            <Link
              href={`/niches/${video.nicheSlug}`}
              className="text-[10px] font-medium text-secondary hover:underline"
            >
              {video.nicheName}
            </Link>
          ) : (
            <span className="text-[10px] text-muted">Unclassified niche</span>
          )}
          <span className="ml-auto">
            <SourceBadge sourceName={video.sourceName} isFixture={video.isFixture} />
          </span>
        </div>
      </div>
    </article>
  );
}
