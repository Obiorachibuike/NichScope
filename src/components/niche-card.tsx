import Link from "next/link";
import { ArrowUpRight, Film, Flame, Video, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScoreBar } from "@/components/score-bar";
import { DemoBadge, SourceBadge } from "@/components/data-badges";
import { SaveNicheButton } from "@/components/save-niche-button";

export interface NicheCardData {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  categoryName: string;
  categorySlug: string;
  opportunityScore: number | null;
  growthTrend: string;
  competitionLevel: string;
  monetizationPotential: string;
  dataConfidence: string;
  formats?: string[];
  avgViews?: number | null;
  isFixture?: boolean;
  sourceName?: string | null;
  childCount?: number;
}

const GROWTH_LABEL: Record<string, { label: string; variant: "success" | "secondary" | "danger" | "muted" }> = {
  fast_growing: { label: "Fast growing", variant: "success" },
  stable: { label: "Stable", variant: "secondary" },
  declining: { label: "Declining", variant: "danger" },
  unknown: { label: "Unknown growth", variant: "muted" },
};

const COMPETITION_LABEL: Record<string, { label: string; variant: "success" | "warning" | "danger" | "muted" }> = {
  low: { label: "Low competition", variant: "success" },
  medium: { label: "Medium competition", variant: "warning" },
  high: { label: "High competition", variant: "danger" },
  unknown: { label: "Competition unknown", variant: "muted" },
};

export function NicheCard({
  niche,
  saved = false,
  watchlistId,
}: {
  niche: NicheCardData;
  saved?: boolean;
  watchlistId?: string;
}) {
  const growth = GROWTH_LABEL[niche.growthTrend] ?? GROWTH_LABEL.unknown!;
  const competition =
    COMPETITION_LABEL[niche.competitionLevel] ?? COMPETITION_LABEL.unknown!;
  const hasMetrics = niche.opportunityScore !== null && niche.opportunityScore !== undefined;

  return (
    <article className="card-hover group flex flex-col rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`/niches/${niche.slug}`}
            className="line-clamp-1 text-[15px] font-semibold text-foreground hover:text-primary"
          >
            {niche.name}
          </Link>
          <p className="mt-0.5 text-xs text-muted">{niche.categoryName}</p>
        </div>
        <SaveNicheButton
          slug={niche.slug}
          initialSaved={saved}
          watchlistId={watchlistId}
        />
      </div>

      <p className="mt-2 line-clamp-2 min-h-[2.5rem] text-xs leading-relaxed text-muted">
        {niche.description ?? "Taxonomy profile with keywords, sub-niches and research links."}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <Badge variant={growth.variant} className="gap-1">
          {niche.growthTrend === "fast_growing" && <Flame className="size-3" />}
          {growth.label}
        </Badge>
        <Badge variant={competition.variant}>{competition.label}</Badge>
        {niche.isFixture && <DemoBadge />}
      </div>

      <div className="mt-4 space-y-2">
        <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-muted">
          <span>Opportunity</span>
          {hasMetrics && (niche.avgViews ?? 0) > 0 && (
            <span className="normal-case tracking-normal text-muted">
              ~{Math.round((niche.avgViews ?? 0) / 1000)}K avg views
            </span>
          )}
        </div>
        <ScoreBar score={niche.opportunityScore} />
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-border/70 pt-3 text-[11px] text-muted">
        <div className="flex items-center gap-2.5">
          {(niche.formats ?? []).includes("shorts") && (
            <span className="flex items-center gap-1">
              <Zap className="size-3" /> Shorts
            </span>
          )}
          {(niche.formats ?? []).includes("long_form") && (
            <span className="flex items-center gap-1">
              <Film className="size-3" /> Long-form
            </span>
          )}
          {(niche.childCount ?? 0) > 0 && (
            <span className="flex items-center gap-1">
              <Video className="size-3" /> {niche.childCount} sub-niches
            </span>
          )}
        </div>
        <Link
          href={`/niches/${niche.slug}`}
          className="flex items-center gap-1 font-medium text-primary opacity-80 transition-opacity group-hover:opacity-100"
        >
          Research <ArrowUpRight className="size-3" />
        </Link>
      </div>

      <div className="mt-2 flex items-center justify-between">
        <SourceBadge sourceName={niche.sourceName} isFixture={niche.isFixture} />
      </div>
    </article>
  );
}
