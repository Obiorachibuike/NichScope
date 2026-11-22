import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowUpRight,
  Bell,
  Bookmark,
  Compass,
  FolderOpen,
  Search,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ScoreBar } from "@/components/score-bar";
import { DemoBadge } from "@/components/data-badges";
import { DeleteSavedSearchButton, WatchlistActions } from "@/components/saved-actions";
import { requireUser } from "@/lib/auth/session";
import { getReadyDb } from "@/lib/db/ready";
import { listAlerts, listSavedSearches, listWatchlist } from "@/lib/services/watchlist";
import { demoMode } from "@/lib/env";
import { formatRelativeTime, titleCase } from "@/lib/utils";

export const metadata: Metadata = { title: "Saved Niches" };
export const dynamic = "force-dynamic";

function queryToHref(query: Record<string, string | string[]>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (Array.isArray(value)) value.forEach((v) => params.append(key, v));
    else if (value) params.set(key, value);
  }
  const stringified = params.toString();
  return stringified ? `/niches?${stringified}` : "/niches";
}

export default async function SavedPage() {
  const user = await requireUser("/saved");
  const db = await getReadyDb();
  const [items, searches, alerts] = await Promise.all([
    listWatchlist(db, user.id),
    listSavedSearches(db, user.id),
    listAlerts(db, user.id, 10),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={
          <>
            <span>Workspace</span>
            <span className="text-border-strong">/</span>
            <span>Watchlist</span>
          </>
        }
        title="Saved Niches"
        description="Your monitored niches, saved searches and eligible change alerts. Everything here is scoped to your account."
        actions={
          <Button asChild size="sm" variant="secondary">
            <Link href="/niches">
              <Compass className="size-4" /> Find more niches
            </Link>
          </Button>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bookmark className="size-4 text-primary" /> Watchlist
              </CardTitle>
              <CardDescription>{items.length} saved niches.</CardDescription>
            </CardHeader>
            <CardContent>
              {items.length === 0 ? (
                <EmptyState
                  icon={Bookmark}
                  title="Your watchlist is empty"
                  description="Save niches from the explorer to monitor them and keep your research notes in one place."
                  action={
                    <Button asChild size="sm">
                      <Link href="/niches">Explore niches</Link>
                    </Button>
                  }
                />
              ) : (
                <ul className="space-y-2">
                  {items.map((item) => (
                    <li
                      key={item.watchlistId}
                      className="rounded-lg border border-border/70 bg-surface/40 p-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <Link
                            href={`/niches/${item.slug}`}
                            className="flex items-center gap-1.5 text-sm font-semibold hover:text-primary"
                          >
                            {item.name} <ArrowUpRight className="size-3" />
                          </Link>
                          <p className="mt-0.5 text-[11px] text-muted">
                            {item.categoryName} · {titleCase(item.growthTrend)} ·{" "}
                            {titleCase(item.competitionLevel)} competition
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="normal-case">
                            <FolderOpen className="size-3" /> {item.folder}
                          </Badge>
                          {item.metadata?.fixtureMetrics === true && demoMode && <DemoBadge />}
                          <WatchlistActions
                            watchlistId={item.watchlistId}
                            name={item.name}
                            notes={item.notes}
                          />
                        </div>
                      </div>
                      <div className="mt-2 w-full max-w-xs">
                        <ScoreBar score={item.opportunityScore} size="sm" />
                      </div>
                      {item.notes && (
                        <p className="mt-2 rounded-md bg-card px-2.5 py-1.5 text-[11px] leading-relaxed text-muted">
                          {item.notes}
                        </p>
                      )}
                      {item.tags.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {item.tags.map((tag) => (
                            <Badge key={tag} variant="muted">{tag}</Badge>
                          ))}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="size-4 text-secondary" /> Saved searches
              </CardTitle>
              <CardDescription>
                Reopen a research query with all filters intact.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {searches.length === 0 ? (
                <EmptyState
                  icon={Search}
                  title="No saved searches"
                  description="Save a filtered explorer view to return to it later."
                />
              ) : (
                <ul className="divide-y divide-border/70">
                  {searches.map((search) => (
                    <li key={search.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                      <span className="flex size-8 items-center justify-center rounded-lg bg-card-elevated text-muted">
                        <Search className="size-3.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <Link
                          href={queryToHref(search.query)}
                          className="block truncate text-sm font-medium hover:text-primary"
                        >
                          {search.name}
                        </Link>
                        <p className="truncate text-[11px] text-muted">
                          {Object.entries(search.query)
                            .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(",") : value}`)
                            .join(" · ") || "No filters"}
                        </p>
                      </div>
                      <DeleteSavedSearchButton id={search.id} />
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <aside>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Bell className="size-3.5 text-muted" /> Alerts
              </CardTitle>
              <CardDescription>Eligible ranking and metric changes.</CardDescription>
            </CardHeader>
            <CardContent>
              {alerts.length === 0 ? (
                <p className="text-xs text-muted">
                  No alerts yet. Alerts are generated by the watchlist monitor job and
                  only reference eligible sources.
                </p>
              ) : (
                <ul className="space-y-2">
                  {alerts.map((alert) => (
                    <li key={alert.id} className="rounded-lg border border-border/70 p-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[11px] leading-relaxed text-muted-strong">
                          {alert.message}
                        </p>
                        <Badge variant="muted">{titleCase(alert.type)}</Badge>
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-[10px] text-muted">
                        <span>{formatRelativeTime(alert.createdAt)}</span>
                        <span>·</span>
                        <Link href={`/niches/${alert.nicheSlug}`} className="hover:text-foreground">
                          {alert.nicheName}
                        </Link>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
