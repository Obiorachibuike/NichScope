import Link from "next/link";
import { ArrowUpRight, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScoreBar } from "@/components/score-bar";
import { DemoBadge } from "@/components/data-badges";
import { cn, formatNumber, formatPercent, titleCase } from "@/lib/utils";

export interface RankingRow {
  nicheId: string;
  slug: string;
  name: string;
  categoryName: string;
  rank: number;
  score: number;
  sourceName?: string;
  sourceKey?: string;
  isFixture: boolean;
  metrics: Record<string, unknown>;
}

function metricNumber(metrics: Record<string, unknown>, key: string): number | null {
  const value = metrics[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value !== "" && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
}

export function RankingTable({
  rows,
  compact = false,
  emptyMessage = "No eligible ranking source is available.",
}: {
  rows: RankingRow[];
  compact?: boolean;
  emptyMessage?: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto scrollbar-thin">
      <table className="w-full min-w-[620px] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-[10px] uppercase tracking-wider text-muted">
            <th className="py-2 pr-3 font-semibold">#</th>
            <th className="py-2 pr-3 font-semibold">Niche</th>
            <th className="py-2 pr-3 font-semibold">Opportunity</th>
            {!compact && <th className="py-2 pr-3 font-semibold">Growth</th>}
            {!compact && <th className="py-2 pr-3 font-semibold">Avg views</th>}
            <th className="py-2 pr-3 font-semibold">Source</th>
            <th className="py-2 text-right font-semibold">Open</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const growth = metricNumber(row.metrics, "viewGrowthPct");
            const avgViews = metricNumber(row.metrics, "avgViews");
            return (
              <tr
                key={`${row.nicheId}-${row.rank}`}
                className="border-b border-border/60 transition-colors last:border-0 hover:bg-card-elevated/50"
              >
                <td className="py-2.5 pr-3">
                  <span
                    className={cn(
                      "flex size-6 items-center justify-center rounded-md text-[11px] font-semibold tabular-nums",
                      row.rank === 1
                        ? "bg-primary-soft text-primary"
                        : "bg-card-elevated text-muted",
                    )}
                  >
                    {row.rank === 1 ? <Trophy className="size-3" /> : row.rank}
                  </span>
                </td>
                <td className="py-2.5 pr-3">
                  <Link
                    href={`/niches/${row.slug}`}
                    className="font-medium text-foreground hover:text-primary"
                  >
                    {row.name}
                  </Link>
                  <p className="text-[11px] text-muted">{row.categoryName}</p>
                </td>
                <td className="w-40 py-2.5 pr-3">
                  <ScoreBar score={row.score} size="sm" />
                </td>
                {!compact && (
                  <td className="py-2.5 pr-3">
                    <span
                      className={cn(
                        "font-mono text-xs tabular-nums",
                        (growth ?? 0) >= 0 ? "text-primary" : "text-danger",
                      )}
                    >
                      {growth === null ? "—" : formatPercent(growth)}
                    </span>
                  </td>
                )}
                {!compact && (
                  <td className="py-2.5 pr-3 text-xs tabular-nums text-muted-strong">
                    {avgViews === null ? "—" : formatNumber(avgViews)}
                  </td>
                )}
                <td className="py-2.5 pr-3">
                  <div className="flex flex-wrap items-center gap-1">
                    {row.isFixture ? (
                      <DemoBadge />
                    ) : (
                      <Badge variant="outline" className="normal-case">
                        {row.sourceName ?? titleCase(row.sourceKey ?? "unknown")}
                      </Badge>
                    )}
                  </div>
                </td>
                <td className="py-2.5 text-right">
                  <Link
                    href={`/niches/${row.slug}`}
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    View <ArrowUpRight className="size-3" />
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
