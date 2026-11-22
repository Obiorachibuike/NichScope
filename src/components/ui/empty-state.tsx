import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  tone = "default",
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  tone?: "default" | "warning";
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-surface/50 px-6 py-12 text-center",
        tone === "warning" && "border-warning/30 bg-warning/[0.03]",
        className,
      )}
    >
      {Icon && (
        <span
          className={cn(
            "flex size-11 items-center justify-center rounded-full border border-border bg-card text-muted",
            tone === "warning" && "border-warning/30 text-warning",
          )}
        >
          <Icon className="size-5" />
        </span>
      )}
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {description && (
          <p className="mx-auto max-w-md text-sm text-muted">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}
