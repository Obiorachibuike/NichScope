import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function Pagination({
  page,
  pageCount,
  basePath,
  params,
  className,
}: {
  page: number;
  pageCount: number;
  basePath: string;
  params: Record<string, string | undefined>;
  className?: string;
}) {
  if (pageCount <= 1) return null;

  const buildHref = (target: number) => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (!value) continue;
      if (key === "page" && target === 1) continue;
      search.set(key, value);
    }
    if (target > 1) search.set("page", String(target));
    const query = search.toString();
    return query ? `${basePath}?${query}` : basePath;
  };

  const pages: (number | "gap")[] = [];
  const windowSize = 5;
  const start = Math.max(1, Math.min(page - 2, pageCount - windowSize + 1));
  const end = Math.min(pageCount, start + windowSize - 1);
  if (start > 1) {
    pages.push(1);
    if (start > 2) pages.push("gap");
  }
  for (let i = start; i <= end; i++) pages.push(i);
  if (end < pageCount) {
    if (end < pageCount - 1) pages.push("gap");
    pages.push(pageCount);
  }

  return (
    <nav
      className={cn("flex flex-wrap items-center justify-center gap-1", className)}
      aria-label="Pagination"
    >
      <Link
        href={buildHref(Math.max(1, page - 1))}
        aria-disabled={page === 1}
        className={cn(
          "flex size-8 items-center justify-center rounded-md border border-border text-muted-strong hover:bg-card",
          page === 1 && "pointer-events-none opacity-40",
        )}
        aria-label="Previous page"
      >
        <ChevronLeft className="size-4" />
      </Link>
      {pages.map((entry, index) =>
        entry === "gap" ? (
          <span key={`gap-${index}`} className="px-1 text-xs text-muted">
            …
          </span>
        ) : (
          <Link
            key={entry}
            href={buildHref(entry)}
            aria-current={entry === page ? "page" : undefined}
            className={cn(
              "flex h-8 min-w-8 items-center justify-center rounded-md border px-2 text-xs font-medium transition-colors",
              entry === page
                ? "border-primary/40 bg-primary-soft text-primary"
                : "border-border text-muted-strong hover:bg-card",
            )}
          >
            {entry}
          </Link>
        ),
      )}
      <Link
        href={buildHref(Math.min(pageCount, page + 1))}
        aria-disabled={page === pageCount}
        className={cn(
          "flex size-8 items-center justify-center rounded-md border border-border text-muted-strong hover:bg-card",
          page === pageCount && "pointer-events-none opacity-40",
        )}
        aria-label="Next page"
      >
        <ChevronRight className="size-4" />
      </Link>
    </nav>
  );
}
