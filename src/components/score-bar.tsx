import { clamp, cn } from "@/lib/utils";

export function ScoreBar({
  score,
  className,
  showLabel = true,
  size = "md",
}: {
  score: number | null | undefined;
  className?: string;
  showLabel?: boolean;
  size?: "sm" | "md";
}) {
  const value = score === null || score === undefined ? null : clamp(score);
  const tone =
    value === null
      ? "bg-border"
      : value >= 70
        ? "bg-primary"
        : value >= 45
          ? "bg-secondary"
          : "bg-warning";
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        className={cn(
          "relative flex-1 overflow-hidden rounded-full bg-card-elevated",
          size === "sm" ? "h-1.5" : "h-2",
        )}
        role="progressbar"
        aria-valuenow={value ?? undefined}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Opportunity score"
      >
        <div
          className={cn("h-full rounded-full transition-all duration-500", tone)}
          style={{ width: `${value ?? 0}%` }}
        />
      </div>
      {showLabel && (
        <span className="w-10 text-right font-mono text-xs tabular-nums text-muted-strong">
          {value === null ? "—" : value.toFixed(0)}
        </span>
      )}
    </div>
  );
}

export function ScoreDial({ score }: { score: number | null | undefined }) {
  const value = score === null || score === undefined ? null : clamp(score);
  const circumference = 2 * Math.PI * 34;
  const offset =
    value === null ? circumference : circumference - (value / 100) * circumference;
  return (
    <div className="relative flex size-24 items-center justify-center">
      <svg viewBox="0 0 80 80" className="size-24 -rotate-90">
        <circle
          cx="40"
          cy="40"
          r="34"
          fill="none"
          stroke="var(--card-elevated)"
          strokeWidth="6"
        />
        <circle
          cx="40"
          cy="40"
          r="34"
          fill="none"
          stroke="var(--primary)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-semibold tabular-nums text-foreground">
          {value === null ? "—" : value.toFixed(0)}
        </span>
        <span className="text-[10px] uppercase tracking-wide text-muted">/ 100</span>
      </div>
    </div>
  );
}
