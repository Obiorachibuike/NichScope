import type { Metadata } from "next";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  Bot,
  CheckCircle2,
  Database,
  ExternalLink,
  Gauge,
  KeyRound,
  ListChecks,
  Network,
  ScrollText,
  ServerCog,
  ShieldCheck,
  Users2,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { JobLauncher, PermissionControls, UserAdminControls } from "@/components/admin-controls";
import {
  CategoryCreator,
  NicheCreator,
  TaxonomyTables,
} from "@/components/taxonomy-manager";

import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { ScoreBar } from "@/components/score-bar";
import { ComplianceNote, DemoBadge } from "@/components/data-badges";
import { Pagination } from "@/components/ui/pagination";
import { requireAdmin } from "@/lib/auth/session";
import { getReadyDb } from "@/lib/db/ready";
import {
  getAdminAuditLog,
  getAiAdminOverview,
  getApiUsageOverview,
  getComplianceOverview,
  getJobsOverview,
  getSystemHealth,
  listCategoriesAdmin,
  listDataSourcesAdmin,
  listNichesAdmin,
  listUsers,
} from "@/lib/services/admin";
import { JOB_NAMES } from "@/lib/jobs/types";
import { demoMode } from "@/lib/env";
import { formatDate, formatNumber, formatRelativeTime, titleCase } from "@/lib/utils";

export const metadata: Metadata = { title: "Admin" };
export const dynamic = "force-dynamic";

const TABS = [
  { key: "overview", label: "Overview", icon: Gauge },
  { key: "users", label: "Users", icon: Users2 },
  { key: "taxonomy", label: "Taxonomy", icon: Network },
  { key: "sources", label: "Data sources", icon: Database },
  { key: "compliance", label: "Compliance", icon: ShieldCheck },
  { key: "usage", label: "API usage", icon: Activity },
  { key: "jobs", label: "Jobs", icon: ServerCog },
  { key: "ai", label: "AI providers", icon: Bot },
  { key: "audit", label: "Audit log", icon: ScrollText },
  { key: "health", label: "Health", icon: ListChecks },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const admin = await requireAdmin("/admin");
  const raw = await searchParams;
  const tabParam = typeof raw.tab === "string" ? raw.tab : "overview";
  const tab: TabKey = TABS.some((item) => item.key === tabParam)
    ? (tabParam as TabKey)
    : "overview";
  const userQuery = typeof raw.q === "string" ? raw.q : undefined;
  const page = Math.max(1, Number(typeof raw.page === "string" ? raw.page : "1") || 1);

  const db = await getReadyDb();
  const [health, jobs, compliance, sources, usage, ai] = await Promise.all([
    getSystemHealth(db),
    getJobsOverview(db),
    getComplianceOverview(db),
    listDataSourcesAdmin(db),
    getApiUsageOverview(db),
    getAiAdminOverview(db),
  ]);

  const users =
    tab === "users"
      ? await listUsers(db, { q: userQuery, page, pageSize: 20 })
      : null;
  const audit = tab === "audit" ? await getAdminAuditLog(db, { limit: 100 }) : [];
  const taxonomy =
    tab === "taxonomy"
      ? await Promise.all([
          listCategoriesAdmin(db),
          listNichesAdmin(db, { q: userQuery, page, pageSize: 20 }),
          listNichesAdmin(db, { pageSize: 100 }),
        ])
      : null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={
          <>
            <span>Operations</span>
            <span className="text-border-strong">/</span>
            <span>Restricted to administrators</span>
          </>
        }
        title="Admin Dashboard"
        description="Governance, data permissions, quota, jobs, AI providers and platform health. Actions here are audited."
        actions={
          <>
            <Badge variant={health.status === "ok" ? "success" : "warning"} className="gap-1">
              <Activity className="size-3" /> {health.status}
            </Badge>
            <Badge variant="outline" className="normal-case">{admin.email}</Badge>
          </>
        }
      />

      {demoMode && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-warning/30 bg-warning/[0.06] px-4 py-2.5 text-xs text-warning">
          <AlertTriangle className="size-4" />
          Demo mode is active. Public metrics and rankings come from labelled development
          fixtures, not YouTube API data.
          <DemoBadge />
        </div>
      )}

      <div className="overflow-x-auto pb-1 scrollbar-thin">
        <nav aria-label="Admin sections" className="inline-flex gap-1 rounded-lg border border-border bg-card p-1">
          {TABS.map((item) => {
            const Icon = item.icon;
            const active = item.key === tab;
            return (
              <Link
                key={item.key}
                href={`/admin?tab=${item.key}`}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted hover:bg-card-elevated hover:text-foreground"
                }`}
              >
                <Icon className="size-3.5" /> {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {tab === "overview" && (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Database"
              value={health.database.engine}
              hint={`${health.database.latencyMs}ms latency${health.database.demoMode ? " · demo mode" : ""}`}
              icon={Database}
            />
            <StatCard
              label="Worker"
              value={health.worker.enabled ? (health.worker.embedded ? "embedded" : "enabled") : "disabled"}
              hint={
                health.worker.lastHeartbeat
                  ? `heartbeat ${formatRelativeTime(health.worker.lastHeartbeat)}`
                  : "no heartbeat recorded"
              }
              icon={ServerCog}
            />
            <StatCard
              label="Jobs failed (24h)"
              value={formatNumber(health.worker.failures24h)}
              hint={`${jobs.counts.queued} queued · ${jobs.counts.deadLetter} dead-letter`}
              icon={ListChecks}
            />
            <StatCard
              label="YouTube quota"
              value={`${usage.quota.percentUsed}%`}
              hint={`${usage.quota.used}/${usage.quota.limit} units · ${usage.quota.cacheHits} cache hits`}
              icon={Gauge}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Compliance posture</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5 text-xs">
                <Row
                  label="YouTube aggregation approval"
                  value={compliance.youtubeApprovalStatus}
                  tone={compliance.youtubeApprovalStatus === "approved" ? "success" : "warning"}
                />
                <Row
                  label="Licensed provider enabled"
                  value={compliance.licensedProviderEnabled ? "true" : "false"}
                  tone={compliance.licensedProviderEnabled ? "success" : "warning"}
                />
                <Row label="Pending permissions" value={String(compliance.pendingPermissions)} />
                <Row
                  label="Rows awaiting retention purge"
                  value={String(compliance.retention.expiredRowsAwaitingPurge)}
                  tone={compliance.retention.expiredRowsAwaitingPurge > 0 ? "danger" : "muted"}
                />
                <Row label="Public retention window" value={`${compliance.retention.retentionDays} days`} />
                <p className="pt-1 text-[11px] leading-relaxed text-muted">
                  Admin toggles never override provider terms. YouTube-derived scoring stays
                  disabled until the deployment flag and a recorded approval reference agree.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Recent compliance activity</CardTitle>
              </CardHeader>
              <CardContent>
                {compliance.audit.length === 0 ? (
                  <p className="text-xs text-muted">No audit entries yet.</p>
                ) : (
                  <ul className="space-y-2 text-xs">
                    {compliance.audit.slice(0, 6).map((entry) => (
                      <li key={entry.id} className="flex items-start justify-between gap-2">
                        <span className="text-muted-strong">{entry.action}</span>
                        <span className="shrink-0 text-[10px] text-muted">
                          {formatRelativeTime(entry.createdAt)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                <Button asChild variant="ghost" size="sm" className="mt-2 px-0">
                  <Link href="/admin?tab=audit">Open audit log →</Link>
                </Button>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Warnings</CardTitle>
              <CardDescription>Deployment checks that affect production readiness.</CardDescription>
            </CardHeader>
            <CardContent>
              {health.warnings.length === 0 ? (
                <p className="flex items-center gap-2 text-xs text-success">
                  <CheckCircle2 className="size-4" /> All core integrations configured.
                </p>
              ) : (
                <ul className="space-y-1.5 text-xs">
                  {health.warnings.map((warning) => (
                    <li key={warning} className="flex items-start gap-2 text-warning">
                      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" /> {warning}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {tab === "users" && users && (
        <Card>
          <CardHeader className="gap-3">
            <div>
              <CardTitle>Users</CardTitle>
              <CardDescription>{users.total} accounts · page {users.page} of {users.pageCount}</CardDescription>
            </div>
            <form method="get" className="flex gap-2">
              <input type="hidden" name="tab" value="users" />
              <Input name="q" defaultValue={userQuery ?? ""} placeholder="Search email or name" className="max-w-xs" />
              <Button type="submit" size="sm" variant="secondary">Search</Button>
            </form>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full min-w-[760px] text-xs">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-wide text-muted">
                    <th className="pb-2 pr-3 font-medium">User</th>
                    <th className="pb-2 pr-3 font-medium">Joined</th>
                    <th className="pb-2 pr-3 font-medium">Last login</th>
                    <th className="pb-2 pr-3 font-medium">Reports</th>
                    <th className="pb-2 font-medium">Role · plan · status</th>
                  </tr>
                </thead>
                <tbody>
                  {users.items.map((user) => (
                    <tr key={user.id} className="border-t border-border/60 align-middle">
                      <td className="py-2 pr-3">
                        <p className="font-medium text-muted-strong">{user.name ?? "Unnamed"}</p>
                        <p className="text-[10px] text-muted">{user.email}</p>
                      </td>
                      <td className="py-2 pr-3 text-muted">{formatDate(user.createdAt)}</td>
                      <td className="py-2 pr-3 text-muted">
                        {user.lastLoginAt ? formatRelativeTime(user.lastLoginAt) : "never"}
                      </td>
                      <td className="py-2 pr-3 tabular-nums text-muted">{user.reportCount}</td>
                      <td className="py-2">
                        <UserAdminControls
                          userId={user.id}
                          role={user.role}
                          plan={user.plan}
                          status={user.status}
                          isSelf={user.id === admin.id}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={users.page}
              pageCount={users.pageCount}
              basePath="/admin"
              params={{ tab: "users", q: userQuery }}
              className="mt-4"
            />
          </CardContent>
        </Card>
      )}

      {tab === "taxonomy" && taxonomy && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <form method="get" className="flex flex-1 flex-wrap gap-2">
              <input type="hidden" name="tab" value="taxonomy" />
              <Input
                name="q"
                defaultValue={userQuery ?? ""}
                placeholder="Search niches by name or slug"
                className="max-w-xs"
              />
              <Button type="submit" size="sm" variant="secondary">Search</Button>
            </form>
            <div className="flex gap-2">
              <CategoryCreator />
              <NicheCreator
                categories={taxonomy[0].map((category) => ({ id: category.id, name: category.name }))}
                niches={taxonomy[2].items.map((niche) => ({ id: niche.id, name: niche.name }))}
              />
            </div>
          </div>
          <ComplianceNote>
            Taxonomy records are first-party and carry no performance statistics. A new
            niche stays unscored until an eligible analytics source supplies metrics;
            public pages then show only source-attributed values.
          </ComplianceNote>
          <TaxonomyTables
            categories={taxonomy[0]}
            niches={taxonomy[1].items}
            total={taxonomy[1].total}
          />
          <Pagination
            page={taxonomy[1].page}
            pageCount={taxonomy[1].pageCount}
            basePath="/admin"
            params={{ tab: "taxonomy", q: userQuery }}
          />
        </div>
      )}

      {tab === "sources" && (
        <div className="space-y-4">
          <ComplianceNote>
            Permissions are stored per source and scope with approval metadata. This table
            edits recorded approvals only; provider terms and deployment flags still gate
            what the app may compute. Denying a scope blocks use immediately.
          </ComplianceNote>
          <div className="grid gap-4 xl:grid-cols-2">
            {sources.map((source) => (
              <Card key={source.id}>
                <CardHeader className="flex-row items-start justify-between gap-2">
                  <div className="min-w-0">
                    <CardTitle className="flex flex-wrap items-center gap-2 text-sm">
                      {source.name}
                      <Badge variant={source.status === "active" ? "success" : "warning"}>
                        {source.status.replaceAll("_", " ")}
                      </Badge>
                    </CardTitle>
                    <CardDescription>
                      {titleCase(source.type)} · {source.retentionDays ? `${source.retentionDays}-day retention · ` : ""}
                      {source.metricRows} metric rows · {source.rankingRows} rankings
                    </CardDescription>
                  </div>
                  {source.termsUrl && (
                    <a
                      href={source.termsUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="flex shrink-0 items-center gap-1 text-[10px] text-primary hover:underline"
                    >
                      Docs <ExternalLink className="size-3" />
                    </a>
                  )}
                </CardHeader>
                <CardContent className="space-y-2">
                  {source.deploymentGate && (
                    <p className="rounded-md border border-warning/25 bg-warning/[0.05] px-2.5 py-1.5 text-[10px] leading-relaxed text-warning">
                      Deployment gate: {source.deploymentGate.variable}
                      {"approved" in source.deploymentGate
                        ? ` is “${source.deploymentGate.approved ? "approved" : "not_approved"}”`
                        : ` is ${source.deploymentGate.enabled ? "enabled" : "disabled"}`}
                      . Set it in the environment before approvals take effect.
                    </p>
                  )}
                  <div className="space-y-1">
                    {source.permissions.length === 0 ? (
                      <p className="text-[11px] text-muted">
                        No permission rows recorded. All uses are denied by default.
                      </p>
                    ) : (
                      source.permissions.map((permission) => (
                        <div
                          key={permission.id}
                          className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-2 py-1"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-[11px] font-medium text-muted-strong">
                              {permission.scope.replaceAll("_", " ")}
                            </p>
                            <p className="text-[10px] text-muted">
                              {permission.approvalRef ?? "No approval reference"}
                            </p>
                          </div>
                          <PermissionControls
                            sourceId={source.id}
                            sourceType={source.type}
                            scope={permission.scope}
                            status={permission.status}
                            gateBlocked={
                              source.type === "youtube_api" &&
                              envApproved(compliance.youtubeApprovalStatus) === false
                                ? "Set YOUTUBE_ANALYTICS_APPROVAL_STATUS=approved and provide the written approval reference."
                                : source.type === "licensed_analytics" &&
                                    !compliance.licensedProviderEnabled
                                  ? "Set LICENSED_DATA_PROVIDER_ENABLED=true before approving licensed scopes."
                                  : null
                            }
                          />
                        </div>
                      ))
                    )}
                  </div>
                  <p className="text-[10px] text-muted">
                    Last verified {source.lastVerifiedAt ? formatDate(source.lastVerifiedAt) : "never"} ·{" "}
                    {source.termsUrl ? (
                      <a href={source.termsUrl} target="_blank" rel="noreferrer noopener" className="hover:text-primary">
                        Terms
                      </a>
                    ) : (
                      "No terms URL"
                    )}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {tab === "compliance" && (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Retention window" value={`${compliance.retention.retentionDays} days`} icon={ShieldCheck} hint={compliance.retention.cutoff.slice(0, 10)} />
            <StatCard label="Expired rows" value={formatNumber(compliance.retention.expiredRowsAwaitingPurge)} icon={Database} hint="Purged by data.retention" />
            <StatCard label="Pending approvals" value={String(compliance.pendingPermissions)} icon={KeyRound} />
            <StatCard label="Demo fixtures" value={compliance.demoMode ? "enabled" : "off"} icon={AlertTriangle} hint="Labelled everywhere in the UI" />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Effective use matrix</CardTitle>
              <CardDescription>
                Server-side evaluation of every use for each source. “Denied” means the
                capability is disabled regardless of admin toggles.
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto scrollbar-thin">
              <table className="w-full min-w-[900px] text-[11px]">
                <thead>
                  <tr className="text-left uppercase tracking-wide text-muted">
                    <th className="pb-2 pr-3 font-medium">Use</th>
                    {compliance.matrix.map((row) => (
                      <th key={row.source.id} className="pb-2 pr-3 font-medium">
                        {row.source.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Object.keys(compliance.matrix[0]?.uses ?? {}).map((use) => (
                    <tr key={use} className="border-t border-border/60">
                      <td className="py-1.5 pr-3 font-medium text-muted-strong">
                        {use.replaceAll("_", " ")}
                      </td>
                      {compliance.matrix.map((row) => {
                        const cell = row.uses[use as keyof typeof row.uses];
                        return (
                          <td key={row.source.id} className="py-1.5 pr-3">
                            <span
                              title={cell?.reason}
                              className={cell?.allowed ? "text-success" : "text-danger"}
                            >
                              {cell?.allowed ? "allowed" : "denied"}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Compliance audit trail</CardTitle>
            </CardHeader>
            <CardContent>
              {compliance.audit.length === 0 ? (
                <EmptyState icon={ScrollText} title="No audit entries" description="Administrative actions and compliance events will appear here." />
              ) : (
                <ul className="space-y-2 text-xs">
                  {compliance.audit.map((entry) => (
                    <li key={entry.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-2 last:border-0">
                      <div>
                        <p className="font-medium text-muted-strong">{entry.action}</p>
                        <p className="text-[10px] text-muted">
                          {entry.actorEmail ?? "system"} · {entry.entityType ?? "n/a"} {entry.entityId?.slice(0, 8) ?? ""}
                        </p>
                      </div>
                      <span className="text-[10px] text-muted">{formatRelativeTime(entry.createdAt)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {tab === "usage" && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>YouTube Data API quota</CardTitle>
              <CardDescription>
                Daily quota resets at midnight Pacific. Cache hits cost nothing.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-semibold tabular-nums">{usage.quota.used.toLocaleString()}</span>
                <span className="text-xs text-muted">of {usage.quota.limit.toLocaleString()} units · {usage.quota.percentUsed}%</span>
              </div>
              <ScoreBar score={usage.quota.percentUsed} showLabel={false} />
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted">
                <Badge variant={usage.quota.configured ? "success" : "warning"}>
                  {usage.quota.configured ? "API key configured" : "API key missing"}
                </Badge>
                <span>Quota date {usage.quota.date}</span>
                <span>·</span>
                <span>{usage.quota.remaining.toLocaleString()} units remaining</span>
                <span>·</span>
                <span>{usage.quota.cacheHits} cache hits today</span>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Usage by endpoint</CardTitle>
              </CardHeader>
              <CardContent>
                {usage.quota.byEndpoint.length === 0 ? (
                  <p className="text-xs text-muted">No YouTube API calls today.</p>
                ) : (
                  <ul className="space-y-2 text-xs">
                    {usage.quota.byEndpoint.map((row) => (
                      <li key={row.endpoint} className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[11px] text-muted-strong">{row.endpoint}</span>
                        <span className="text-muted">{row.calls} calls · {row.units} units</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Recent requests</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto scrollbar-thin">
                {usage.recent.length === 0 ? (
                  <p className="text-xs text-muted">No recent requests recorded.</p>
                ) : (
                  <table className="w-full min-w-[520px] text-[11px]">
                    <thead>
                      <tr className="text-left uppercase tracking-wide text-muted">
                        <th className="pb-2 font-medium">Endpoint</th>
                        <th className="pb-2 font-medium">Status</th>
                        <th className="pb-2 font-medium">Units</th>
                        <th className="pb-2 font-medium">Latency</th>
                        <th className="pb-2 font-medium">Cache</th>
                        <th className="pb-2 font-medium">When</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usage.recent.map((row, index) => (
                        <tr key={`${row.endpoint}-${index}`} className="border-t border-border/60">
                          <td className="py-1.5 font-mono">{row.endpoint}</td>
                          <td className={`py-1.5 ${row.statusCode && row.statusCode >= 400 ? "text-danger" : "text-success"}`}>
                            {row.statusCode ?? "—"}
                          </td>
                          <td className="py-1.5 text-muted">{row.units}</td>
                          <td className="py-1.5 text-muted">{row.latencyMs ? `${row.latencyMs}ms` : "—"}</td>
                          <td className="py-1.5 text-muted">{row.cacheHit ? "hit" : "miss"}</td>
                          <td className="py-1.5 text-muted">{formatRelativeTime(row.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {tab === "jobs" && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-5">
            <StatCard label="Queued" value={String(jobs.counts.queued)} icon={ListChecks} />
            <StatCard label="Running" value={String(jobs.counts.running)} icon={Activity} />
            <StatCard label="Completed" value={formatNumber(jobs.counts.completed)} icon={CheckCircle2} />
            <StatCard label="Failed" value={String(jobs.counts.failed)} icon={AlertTriangle} />
            <StatCard label="Dead letter" value={String(jobs.counts.deadLetter)} icon={ServerCog} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Enqueue a job</CardTitle>
              <CardDescription>
                Queue enabled: {String(jobs.queueEnabled)} · embedded runner: {String(jobs.embedded)}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <JobLauncher jobs={JOB_NAMES} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Recent jobs</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto scrollbar-thin">
              {jobs.jobs.length === 0 ? (
                <EmptyState icon={ServerCog} title="No jobs yet" description="Queue a job above or wait for the worker schedule." />
              ) : (
                <table className="w-full min-w-[760px] text-[11px]">
                  <thead>
                    <tr className="text-left uppercase tracking-wide text-muted">
                      <th className="pb-2 font-medium">Job</th>
                      <th className="pb-2 font-medium">Status</th>
                      <th className="pb-2 font-medium">Attempts</th>
                      <th className="pb-2 font-medium">Created</th>
                      <th className="pb-2 font-medium">Finished</th>
                      <th className="pb-2 font-medium">Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobs.jobs.map((job) => (
                      <tr key={job.id} className="border-t border-border/60">
                        <td className="py-1.5 font-mono">{job.name}</td>
                        <td className="py-1.5">
                          <Badge
                            variant={
                              job.status === "completed"
                                ? "success"
                                : job.status === "failed" || job.status === "dead_letter"
                                  ? "danger"
                                  : job.status === "running"
                                    ? "secondary"
                                    : "muted"
                            }
                          >
                            {job.status.replaceAll("_", " ")}
                          </Badge>
                        </td>
                        <td className="py-1.5 text-muted">{job.attempts}/{job.maxAttempts}</td>
                        <td className="py-1.5 text-muted">{formatRelativeTime(job.createdAt)}</td>
                        <td className="py-1.5 text-muted">
                          {job.completedAt ? formatRelativeTime(job.completedAt) : "—"}
                        </td>
                        <td className="max-w-[280px] truncate py-1.5 text-danger" title={job.error ?? undefined}>
                          {job.error ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {tab === "ai" && (
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Provider usage (24h)</CardTitle>
                <CardDescription>
                  Last report {ai.lastReportAt ? formatRelativeTime(ai.lastReportAt) : "never"}.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {ai.providers.length === 0 ? (
                  <p className="text-xs text-muted">No AI reports in the last 24 hours.</p>
                ) : (
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="text-left uppercase tracking-wide text-muted">
                        <th className="pb-2 font-medium">Provider</th>
                        <th className="pb-2 font-medium">Reports</th>
                        <th className="pb-2 font-medium">Failures</th>
                        <th className="pb-2 font-medium">Tokens</th>
                        <th className="pb-2 font-medium">Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ai.providers.map((row) => (
                        <tr key={row.provider} className="border-t border-border/60">
                          <td className="py-1.5 font-medium">{row.provider}</td>
                          <td className="py-1.5 text-muted">{row.reports}</td>
                          <td className={`py-1.5 ${row.failures > 0 ? "text-danger" : "text-muted"}`}>{row.failures}</td>
                          <td className="py-1.5 text-muted">{row.tokens.toLocaleString()}</td>
                          <td className="py-1.5 text-muted">${row.costUsd.toFixed(4)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Configured providers</CardTitle>
                <CardDescription>Primary: {ai.status.primary?.key ?? "none"}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                {ai.status.providers.map((provider) => (
                  <div key={provider.key} className="flex items-center justify-between gap-2">
                    <span className="capitalize text-muted-strong">{provider.key}</span>
                    <span className="flex items-center gap-2">
                      <span className="font-mono text-[10px] text-muted">{provider.model}</span>
                      <Badge variant={provider.configured ? "success" : "muted"}>
                        {provider.configured ? "ready" : "missing key"}
                      </Badge>
                    </span>
                  </div>
                ))}
                <p className="pt-2 text-[10px] leading-relaxed text-muted">
                  Fallback order: {ai.status.fallbacks.map((fallback) => fallback.key).join(" → ") || "none"}.
                  Token budgets and cost caps are enforced per user and platform-wide.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {tab === "audit" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Audit log</CardTitle>
            <CardDescription>Last {audit.length} events, newest first.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto scrollbar-thin">
            {audit.length === 0 ? (
              <EmptyState icon={ScrollText} title="No audit events" description="Sign-ins, admin changes, AI generation and compliance actions are recorded." />
            ) : (
              <table className="w-full min-w-[760px] text-[11px]">
                <thead>
                  <tr className="text-left uppercase tracking-wide text-muted">
                    <th className="pb-2 font-medium">Action</th>
                    <th className="pb-2 font-medium">Actor</th>
                    <th className="pb-2 font-medium">Entity</th>
                    <th className="pb-2 font-medium">Metadata</th>
                    <th className="pb-2 font-medium">When</th>
                  </tr>
                </thead>
                <tbody>
                  {audit.map((entry) => (
                    <tr key={entry.id} className="border-t border-border/60">
                      <td className="py-1.5 font-mono">{entry.action}</td>
                      <td className="py-1.5 text-muted">{entry.actorEmail ?? "system"}</td>
                      <td className="py-1.5 text-muted">
                        {entry.entityType ?? "—"}
                        {entry.entityId ? ` · ${entry.entityId.slice(0, 8)}` : ""}
                      </td>
                      <td className="max-w-[320px] truncate py-1.5 font-mono text-[10px] text-muted">
                        {entry.metadata ? JSON.stringify(entry.metadata) : "—"}
                      </td>
                      <td className="py-1.5 text-muted">{formatRelativeTime(entry.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "health" && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Status" value={health.status} icon={Activity} hint={`${health.uptimeSeconds}s uptime`} />
            <StatCard label="DB latency" value={`${health.database.latencyMs}ms`} icon={Database} hint={health.database.engine} />
            <StatCard label="Channels stored" value={formatNumber(health.data.channels)} icon={Users2} />
            <StatCard label="Videos stored" value={formatNumber(health.data.videos)} icon={ServerCog} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Health snapshot</CardTitle>
              <CardDescription>Generated {formatDate(health.timestamp, { dateStyle: "medium", timeStyle: "short" })}</CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="max-h-[480px] overflow-auto rounded-lg border border-border bg-surface p-3 text-[11px] leading-relaxed text-muted-strong scrollbar-thin">
                {JSON.stringify(health, null, 2)}
              </pre>
            </CardContent>
          </Card>

          <div className="grid gap-3 sm:grid-cols-3">
            <MiniStatus label="Sentry monitoring" ok={health.monitoring.sentryConfigured} />
            <MiniStatus label="YouTube API" ok={health.youtube.configured} />
            <MiniStatus label="AI provider" ok={Boolean(health.ai)} />
          </div>
        </div>
      )}
    </div>
  );
}

function envApproved(value: string) {
  return value === "approved";
}

function Row({
  label,
  value,
  tone = "muted",
}: {
  label: string;
  value: string;
  tone?: "success" | "warning" | "danger" | "muted";
}) {
  const color =
    tone === "success"
      ? "text-success"
      : tone === "warning"
        ? "text-warning"
        : tone === "danger"
          ? "text-danger"
          : "text-muted-strong";
  return (
    <div className="flex items-center justify-between gap-2 border-b border-border/50 pb-2 last:border-0 last:pb-0">
      <span className="text-muted">{label}</span>
      <span className={`font-medium ${color}`}>{value}</span>
    </div>
  );
}

function MiniStatus({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2.5 text-xs">
      <span className="text-muted">{label}</span>
      <Badge variant={ok ? "success" : "warning"}>{ok ? "configured" : "missing"}</Badge>
    </div>
  );
}
