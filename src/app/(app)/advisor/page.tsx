import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import {
  ArrowUpRight,
  BrainCircuit,
  CheckCircle2,
  CircleSlash,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { AiAdvisorForm } from "@/components/ai-advisor-form";
import { ReportView } from "@/components/report-view";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ScoreBar } from "@/components/score-bar";
import { ComplianceNote } from "@/components/data-badges";
import { requireUser } from "@/lib/auth/session";
import { getReadyDb } from "@/lib/db/ready";
import { categories, niches } from "@/lib/db/schema";
import {
  getAIStatus,
  getAiUsage,
  getReport,
  listReports,
  labelForType,
} from "@/lib/services/ai";
import { formatRelativeTime } from "@/lib/utils";

export const metadata: Metadata = { title: "AI Niche Advisor" };
export const dynamic = "force-dynamic";

export default async function AdvisorPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser("/advisor");
  const raw = await searchParams;
  const nicheSlug = typeof raw.niche === "string" ? raw.niche : undefined;
  const reportId = typeof raw.report === "string" ? raw.report : undefined;

  const db = await getReadyDb();
  const [nicheOptions, usage, reports, status, storedReport] = await Promise.all([
    db
      .select({ slug: niches.slug, name: niches.name, categoryName: categories.name })
      .from(niches)
      .innerJoin(categories, eq(niches.categoryId, categories.id))
      .where(eq(niches.isActive, true))
      .orderBy(desc(niches.opportunityScore), niches.name)
      .limit(200),
    getAiUsage(db, user.id, user.plan),
    listReports(db, user.id, 12),
    Promise.resolve(getAIStatus()),
    reportId ? getReport(db, user.id, reportId) : Promise.resolve(null),
  ]);

  const initialNiche = nicheSlug
    ? nicheOptions.find((option) => option.slug === nicheSlug)
    : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={
          <>
            <span>Research</span>
            <span className="text-border-strong">/</span>
            <span>Evidence-grounded AI</span>
          </>
        }
        title="AI Niche Advisor"
        description="Turn permitted evidence into audience, positioning, format and video-idea guidance — with verified facts, estimates and recommendations kept separate."
        actions={
          <Badge variant={status.primary ? "success" : "warning"} className="gap-1">
            {status.primary ? <CheckCircle2 className="size-3" /> : <CircleSlash className="size-3" />}
            {status.primary ? `${status.primary.key} · ${status.primary.model}` : "No provider configured"}
          </Badge>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_330px]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="size-4 text-primary" /> Generate research
              </CardTitle>
              <CardDescription>
                Reports are saved to your account. Daily limits apply per plan.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AiAdvisorForm
                niches={nicheOptions}
                nicheSlug={initialNiche?.slug}
                initialType={storedReport ? storedReport.report.type : "niche_analysis"}
                usage={usage}
                existingReport={
                  storedReport
                    ? {
                        type: storedReport.report.type,
                        report: storedReport.report.report,
                        provider: storedReport.report.provider,
                        model: storedReport.report.model,
                        createdAt: storedReport.report.createdAt,
                        title: storedReport.report.title,
                      }
                    : null
                }
              />
            </CardContent>
          </Card>

          {storedReport && (
            <Card>
              <CardHeader className="flex-row items-start justify-between">
                <div>
                  <CardTitle>{storedReport.report.title}</CardTitle>
                  <CardDescription>
                    Saved report · {formatRelativeTime(storedReport.report.createdAt)} ·{" "}
                    {storedReport.report.status}
                  </CardDescription>
                </div>
                {storedReport.nicheSlug && (
                  <Button asChild variant="ghost" size="sm">
                    <Link href={`/niches/${storedReport.nicheSlug}`}>
                      Open niche <ArrowUpRight className="size-3.5" />
                    </Link>
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                <ReportView
                  type={storedReport.report.type}
                  report={storedReport.report.report}
                  provider={storedReport.report.provider}
                  model={storedReport.report.model}
                  createdAt={storedReport.report.createdAt}
                />
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Report library</CardTitle>
              <CardDescription>Your last {reports.length} AI reports.</CardDescription>
            </CardHeader>
            <CardContent>
              {reports.length === 0 ? (
                <EmptyState
                  icon={BrainCircuit}
                  title="No reports yet"
                  description="Generate your first report above. Reports persist so you can revisit the reasoning later."
                />
              ) : (
                <ul className="divide-y divide-border/70">
                  {reports.map((report) => (
                    <li key={report.id} className="flex flex-wrap items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                      <span className="flex size-8 items-center justify-center rounded-lg bg-card-elevated text-muted">
                        <BrainCircuit className="size-3.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/advisor?report=${report.id}`}
                          className="block truncate text-sm font-medium hover:text-primary"
                        >
                          {report.title}
                        </Link>
                        <p className="text-[11px] text-muted">
                          {labelForType(report.type)} · {formatRelativeTime(report.createdAt)} ·{" "}
                          {report.provider}
                          {report.isFallback ? " (fallback)" : ""}
                        </p>
                      </div>
                      <Badge
                        variant={
                          report.status === "completed"
                            ? "success"
                            : report.status === "failed"
                              ? "danger"
                              : "muted"
                        }
                      >
                        {report.status}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Usage</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-semibold tabular-nums">{usage.usedToday}</span>
                <span className="text-xs text-muted">of {usage.limit} today</span>
              </div>
              <ScoreBar score={(usage.usedToday / Math.max(1, usage.limit)) * 100} showLabel={false} />
              <p className="text-[11px] text-muted">
                {usage.remaining} remaining · ${usage.costToday.toFixed(4)} model cost today
              </p>
              <p className="text-[11px] text-muted">
                Platform cost cap: ${usage.costCapUsd.toFixed(2)} / 24h
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <ShieldCheck className="size-3.5 text-muted" /> Provider status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              {status.providers.map((provider) => (
                <div key={provider.key} className="flex items-center justify-between gap-2">
                  <span className="capitalize text-muted-strong">{provider.key}</span>
                  <Badge variant={provider.configured ? "success" : "muted"}>
                    {provider.configured ? "configured" : "not configured"}
                  </Badge>
                </div>
              ))}
              <div className="mt-2 border-t border-border pt-2 text-[11px] text-muted">
                Primary: {status.primary?.key ?? "none"}
                {status.fallbacks.length > 0 &&
                  ` · fallback: ${status.fallbacks.map((fallback) => fallback.key).join(", ")}`}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">How evidence is used</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-[11px] leading-relaxed text-muted">
              <p>
                Only taxonomy facts, keywords, sub-niches and metrics you are permitted
                to see are sent to the model.
              </p>
              <p>
                Metrics are labelled with their source and confidence. Demo fixtures are
                marked as fixtures, and no provider may invent statistics.
              </p>
              <p>
                AI output is stored with its evidence snapshot so results remain
                auditable after data changes.
              </p>
            </CardContent>
          </Card>

          {!status.primary && (
            <ComplianceNote>
              No AI provider is configured. Set AGNES_API_KEY (primary) or OPENAI_API_KEY
              (fallback). Demo mode falls back to a deterministic offline generator that
              is clearly labelled.
            </ComplianceNote>
          )}
        </aside>
      </div>
    </div>
  );
}
