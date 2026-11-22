import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={cn("size-8", className)}
    >
      <rect
        x="1.5"
        y="1.5"
        width="29"
        height="29"
        rx="9"
        stroke="currentColor"
        strokeWidth="1.5"
        className="text-border-strong"
      />
      <path
        d="M9 22V10l9 8.5V10"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-foreground"
      />
      <circle cx="23" cy="21.5" r="2.6" className="fill-primary" />
    </svg>
  );
}

export function Logo({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      {!compact && (
        <span className="flex flex-col leading-none">
          <span className="text-[15px] font-semibold tracking-tight text-foreground">
            NicheScope
          </span>
          <span className="mt-1 text-[10px] font-medium uppercase tracking-[0.18em] text-muted">
            Niche intelligence
          </span>
        </span>
      )}
    </span>
  );
}
