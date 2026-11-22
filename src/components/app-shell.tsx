"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  Activity,
  Bookmark,
  ChevronDown,
  Compass,
  CreditCard,
  Film,
  FlaskConical,
  LayoutDashboard,
  LogOut,
  Menu,
  Network,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Tv,
  User as UserIcon,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Dialog as SearchDialog, DialogContent } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ShellUser {
  id: string;
  name?: string | null;
  email?: string | null;
  role: "user" | "admin";
  plan: "free" | "pro" | "team";
}

interface Suggestion {
  type: "niche" | "keyword" | "category";
  label: string;
  slug: string;
  meta?: string;
}

const NAV_GROUPS: {
  label: string;
  items: { href: string; label: string; icon: typeof Compass; adminOnly?: boolean }[];
}[] = [
  {
    label: "Discover",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/niches", label: "Niche Explorer", icon: Compass },
      { href: "/subniches", label: "Sub-niches", icon: Network },
      { href: "/trends", label: "Global Trends", icon: TrendingUp },
    ],
  },
  {
    label: "Research",
    items: [
      { href: "/channels", label: "Channel Intelligence", icon: Tv },
      { href: "/videos", label: "Video Research", icon: Film },
      { href: "/advisor", label: "AI Niche Advisor", icon: Sparkles },
    ],
  },
  {
    label: "Workspace",
    items: [
      { href: "/saved", label: "Saved Niches", icon: Bookmark },
      { href: "/settings", label: "Settings", icon: Settings },
      { href: "/billing", label: "Billing", icon: CreditCard },
    ],
  },
  {
    label: "Operations",
    items: [{ href: "/admin", label: "Admin", icon: ShieldCheck, adminOnly: true }],
  },
];

function NavLinks({
  user,
  counts,
  onNavigate,
}: {
  user: ShellUser;
  counts: { saved: number; reports: number };
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-5 px-3">
      {NAV_GROUPS.map((group) => {
        const items = group.items.filter((item) => !item.adminOnly || user.role === "admin");
        if (items.length === 0) return null;
        return (
          <div key={group.label} className="space-y-1">
            <p className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted/80">
              {group.label}
            </p>
            {items.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));
              const Icon = item.icon;
              const badge =
                item.href === "/saved" && counts.saved > 0
                  ? counts.saved
                  : item.href === "/advisor" && counts.reports > 0
                    ? counts.reports
                    : null;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary-soft text-primary"
                      : "text-muted-strong hover:bg-card hover:text-foreground",
                  )}
                >
                  <Icon
                    className={cn(
                      "size-4 shrink-0 transition-colors",
                      active ? "text-primary" : "text-muted group-hover:text-foreground",
                    )}
                  />
                  <span className="truncate">{item.label}</span>
                  {badge !== null && (
                    <span className="ml-auto rounded-full bg-card-elevated px-1.5 py-0.5 text-[10px] font-semibold text-muted">
                      {badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}

function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [history, setHistory] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => inputRef.current?.focus(), 40);
    const controller = new AbortController();
    fetch("/api/v1/search/history", { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { data?: string[] } | null) => {
        if (payload?.data) setHistory(payload.data);
      })
      .catch(() => undefined);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [open]);

  useEffect(() => {
    if (query.trim().length < 2) {
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/v1/search/suggest?q=${encodeURIComponent(query)}`,
          { signal: controller.signal },
        );
        if (response.ok) {
          const data = (await response.json()) as { data: Suggestion[] };
          setSuggestions(data.data ?? []);
          setActive(0);
        }
      } catch {
        // aborted
      } finally {
        setLoading(false);
      }
    }, 220);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query]);

  const go = (suggestion?: Suggestion) => {
    setOpen(false);
    if (suggestion?.type === "category") {
      router.push(`/niches?category=${encodeURIComponent(suggestion.slug)}`);
    } else if (suggestion) {
      router.push(`/niches/${suggestion.slug}`);
    } else if (query.trim().length > 0) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group flex h-9 w-full max-w-md items-center gap-2 rounded-lg border border-border bg-surface px-3 text-left text-sm text-muted transition-colors hover:border-border-strong hover:text-muted-strong"
        aria-label="Search niches, channels and videos"
      >
        <Search className="size-4" />
        <span className="truncate">Search niches, channels, videos…</span>
        <kbd className="ml-auto hidden rounded border border-border bg-card px-1.5 py-0.5 text-[10px] font-medium text-muted sm:block">
          ⌘K
        </kbd>
      </button>

      <SearchDialog open={open} onOpenChange={setOpen}>
        <DialogContent className="top-[18%] max-w-xl translate-y-0 gap-0 p-0">
          <Dialog.Title className="sr-only">Global search</Dialog.Title>
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <Search className="size-4 text-muted" />
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setActive((value) => Math.min(value + 1, suggestions.length - 1));
                } else if (event.key === "ArrowUp") {
                  event.preventDefault();
                  setActive((value) => Math.max(value - 1, 0));
                } else if (event.key === "Enter") {
                  event.preventDefault();
                  go(suggestions[active]);
                }
              }}
              placeholder="Search niches, keywords or categories"
              className="h-6 w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted"
              aria-label="Search query"
            />
            {loading && <span className="size-3 animate-spin rounded-full border border-muted border-t-transparent" />}
          </div>
          <div className="max-h-[340px] overflow-y-auto p-2 scrollbar-thin">
            {query.trim().length < 2 ? (
              history.length > 0 ? (
                <div className="p-1">
                  <p className="px-2 py-1.5 text-[10px] font-medium uppercase tracking-wide text-muted">
                    Recent searches
                  </p>
                  {history.map((term) => (
                    <button
                      key={term}
                      type="button"
                      onClick={() => setQuery(term)}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-muted-strong transition-colors hover:bg-card-elevated"
                    >
                      <span className="flex size-7 items-center justify-center rounded-md bg-card text-muted">
                        <Search className="size-3.5" />
                      </span>
                      {term}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="px-3 py-6 text-center text-sm text-muted">
                  Type at least 2 characters to search the taxonomy.
                </p>
              )
            ) : suggestions.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted">
                No taxonomy matches. Press Enter for full search.
              </p>
            ) : (
              suggestions.map((suggestion, index) => (
                <button
                  key={`${suggestion.type}-${suggestion.slug}-${suggestion.label}`}
                  type="button"
                  onMouseEnter={() => setActive(index)}
                  onClick={() => go(suggestion)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                    index === active ? "bg-card-elevated" : "hover:bg-card-elevated",
                  )}
                >
                  <span className="flex size-7 items-center justify-center rounded-md bg-card text-muted">
                    {suggestion.type === "keyword" ? (
                      <Search className="size-3.5" />
                    ) : suggestion.type === "category" ? (
                      <Network className="size-3.5" />
                    ) : (
                      <Compass className="size-3.5" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-foreground">
                      {suggestion.label}
                    </span>
                    {suggestion.meta && (
                      <span className="block truncate text-xs text-muted">
                        {suggestion.meta}
                      </span>
                    )}
                  </span>
                  <span className="text-[10px] uppercase tracking-wide text-muted">
                    {suggestion.type}
                  </span>
                </button>
              ))
            )}
          </div>
          <div className="flex items-center justify-between border-t border-border px-4 py-2 text-[11px] text-muted">
            <span>Search is taxonomy-backed and keyword-aware.</span>
            <button
              type="button"
              className="text-primary hover:underline"
              onClick={() => go()}
            >
              View all results ↵
            </button>
          </div>
        </DialogContent>
      </SearchDialog>
    </>
  );
}

export function AppShell({
  user,
  counts,
  demoData,
  children,
}: {
  user: ShellUser;
  counts: { saved: number; reports: number };
  demoData: boolean;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const initials = (user.name ?? user.email ?? "U")
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[256px_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-border bg-surface lg:flex">
        <div className="flex h-16 items-center px-5">
          <Link href="/dashboard" aria-label="NicheScope dashboard">
            <Logo />
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto pb-4 scrollbar-thin">
          <NavLinks user={user} counts={counts} />
        </div>
        <div className="border-t border-border p-3">
          <div className="rounded-lg border border-border bg-card p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-muted-strong">Current plan</p>
              <Badge variant={user.plan === "free" ? "muted" : "default"}>
                {user.plan}
              </Badge>
            </div>
            {user.plan === "free" ? (
              <>
                <p className="mt-1 text-xs text-muted">
                  Upgrade for more AI reports and saved niches.
                </p>
                <Button asChild size="sm" className="mt-2 w-full">
                  <Link href="/billing">View plans</Link>
                </Button>
              </>
            ) : (
              <p className="mt-1 text-xs text-muted">
                AI reports and watchlists are active.
              </p>
            )}
          </div>
        </div>
      </aside>

      <div className="flex min-h-dvh min-w-0 flex-col">
        <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-xl">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="flex size-9 items-center justify-center rounded-lg border border-border text-muted-strong hover:bg-card lg:hidden"
              aria-label="Open navigation"
            >
              <Menu className="size-4" />
            </button>
            <Link href="/dashboard" className="lg:hidden" aria-label="NicheScope">
              <LogoMarkSmall />
            </Link>
            <div className="hidden flex-1 sm:flex">
              <GlobalSearch />
            </div>
            <div className="ml-auto flex items-center gap-1.5">
              {demoData && (
                <span className="hidden items-center gap-1.5 rounded-full border border-warning/30 bg-warning/10 px-2.5 py-1 text-[11px] font-medium text-warning md:flex">
                  <FlaskConical className="size-3" />
                  Demo fixtures
                </span>
              )}
              <Link
                href="/trends"
                className="hidden items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-strong hover:bg-card sm:flex"
              >
                <Activity className="size-3.5" />
                Status
              </Link>
              <ThemeToggle />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center gap-2 rounded-lg border border-border bg-card px-2 py-1.5 text-sm hover:border-border-strong"
                    aria-label="Account menu"
                  >
                    <span className="flex size-6 items-center justify-center rounded-md bg-primary-soft text-[11px] font-semibold text-primary">
                      {initials || <UserIcon className="size-3" />}
                    </span>
                    <span className="hidden max-w-[120px] truncate text-xs font-medium text-muted-strong sm:block">
                      {user.name ?? user.email}
                    </span>
                    <ChevronDown className="size-3.5 text-muted" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="normal-case">
                    <span className="block text-sm font-medium text-foreground">
                      {user.name ?? "Creator"}
                    </span>
                    <span className="block truncate text-xs text-muted">
                      {user.email}
                    </span>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/settings">
                      <Settings className="size-4" /> Settings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/saved">
                      <Bookmark className="size-4" /> Saved niches
                    </Link>
                  </DropdownMenuItem>
                  {user.role === "admin" && (
                    <DropdownMenuItem asChild>
                      <Link href="/admin">
                        <ShieldCheck className="size-4" /> Admin dashboard
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={() => void signOut({ callbackUrl: "/" })}
                    className="text-danger focus:text-danger"
                  >
                    <LogOut className="size-4" /> Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          <div className="px-4 pb-3 sm:hidden">
            <GlobalSearch />
          </div>
          {demoData && (
            <div className="border-t border-warning/20 bg-warning/[0.06] px-4 py-2 text-[11px] leading-relaxed text-warning sm:px-6 lg:px-8">
              <strong className="font-semibold">Demo mode:</strong> the taxonomy and
              research workflow are live, but performance/ranking values are
              clearly-labelled fixtures. Configure a licensed analytics provider to
              publish production rankings.
            </div>
          )}
        </header>

        <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>

        <footer className="border-t border-border px-4 py-5 text-xs text-muted sm:px-6 lg:px-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p>
              © {new Date().getFullYear()} NicheScope. YouTube public data is used
              under the YouTube API Services Terms.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link href="/trends" className="hover:text-muted-strong">
                Data sources
              </Link>
              <a
                href="https://developers.google.com/youtube/terms/developer-policies"
                target="_blank"
                rel="noreferrer noopener"
                className="hover:text-muted-strong"
              >
                YouTube policies
              </a>
            </div>
          </div>
        </footer>
      </div>

      {/* Mobile navigation drawer */}
      <Dialog.Root open={mobileOpen} onOpenChange={setMobileOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-overlay backdrop-blur-sm data-[state=open]:animate-fade-in lg:hidden" />
          <Dialog.Content className="fixed left-0 top-0 z-50 flex h-dvh w-[86%] max-w-xs flex-col border-r border-border bg-surface shadow-2xl data-[state=open]:animate-slide-up lg:hidden">
            <Dialog.Title className="sr-only">Navigation</Dialog.Title>
            <div className="flex h-16 items-center justify-between px-4">
              <Logo />
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="flex size-8 items-center justify-center rounded-lg border border-border text-muted hover:bg-card"
                  aria-label="Close navigation"
                >
                  <X className="size-4" />
                </button>
              </Dialog.Close>
            </div>
            <div className="flex-1 overflow-y-auto pb-6">
              <NavLinks user={user} counts={counts} onNavigate={() => setMobileOpen(false)} />
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

function LogoMarkSmall() {
  return (
    <span className="flex h-8 items-center gap-2">
      <svg viewBox="0 0 32 32" className="size-7" fill="none" aria-hidden="true">
        <rect x="1.5" y="1.5" width="29" height="29" rx="9" stroke="var(--border-strong)" strokeWidth="1.5" />
        <path d="M9 22V10l9 8.5V10" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="23" cy="21.5" r="2.6" fill="var(--primary)" />
      </svg>
      <span className="text-sm font-semibold tracking-tight">NicheScope</span>
    </span>
  );
}
