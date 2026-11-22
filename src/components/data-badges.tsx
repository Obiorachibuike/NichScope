import { Database, FlaskConical, ShieldCheck, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function DemoBadge({ className }: { className?: string }) {
  return (
    <Badge variant="warning" className={cn("gap-1", className)} title="Clearly-labelled demo fixture — not live YouTube data">
      <FlaskConical className="size-3" />
      Demo data
    </Badge>
  );
}

export function SourceBadge({
  sourceName,
  isFixture,
  className,
}: {
  sourceName?: string | null;
  isFixture?: boolean;
  className?: string;
}) {
  if (!sourceName) {
    return (
      <Badge variant="muted" className={className}>
        No data source
      </Badge>
    );
  }
  return (
    <Badge
      variant={isFixture ? "warning" : "outline"}
      className={cn("gap-1 normal-case", className)}
      title={`Source: ${sourceName}`}
    >
      <Database className="size-3" />
      {sourceName}
    </Badge>
  );
}

export function ConfidenceBadge({ confidence }: { confidence: string }) {
  if (confidence === "verified") {
    return (
      <Badge variant="success" className="gap-1">
        <ShieldCheck className="size-3" /> Verified
      </Badge>
    );
  }
  if (confidence === "estimated") {
    return <Badge variant="secondary">Estimate</Badge>;
  }
  return <Badge variant="muted">Unknown</Badge>;
}

export function ComplianceNote({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "flex items-start gap-2 rounded-lg border border-warning/25 bg-warning/[0.04] px-3 py-2 text-xs leading-relaxed text-muted-strong",
        className,
      )}
    >
      <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-warning" />
      <span>{children}</span>
    </p>
  );
}

export function Freshness({
  label,
  date,
  isDemo,
}: {
  label: string;
  date: Date | string | null;
  isDemo?: boolean;
}) {
  const value = date
    ? new Intl.DateTimeFormat("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "UTC",
      }).format(new Date(date))
    : "not yet";
  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="text-muted">{label}</span>
      <span className="flex items-center gap-1.5 font-medium text-muted-strong">
        {isDemo && <span className="size-1.5 rounded-full bg-warning" />}
        {value}
      </span>
    </div>
  );
}
