import { Bot, CheckCircle2, CircleDot, Sparkles, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type AnyRecord = Record<string, unknown>;

function isRecord(value: unknown): value is AnyRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted">
        {title}
      </h3>
      <div className="text-sm leading-relaxed text-muted-strong">{children}</div>
    </section>
  );
}

function List({ items }: { items: unknown }) {
  if (!Array.isArray(items) || items.length === 0) {
    return <p className="text-sm text-muted">Not covered in this report.</p>;
  }
  return (
    <ul className="space-y-1.5">
      {items.map((item, index) => {
        if (typeof item === "string") {
          return (
            <li key={index} className="flex gap-2">
              <CircleDot className="mt-1 size-3 shrink-0 text-primary/70" />
              <span>{item}</span>
            </li>
          );
        }
        if (isRecord(item)) {
          const primary =
            (item.title as string) ??
            (item.name as string) ??
            (item.segment as string) ??
            (item.format as string) ??
            "Untitled";
          const secondary =
            (item.description as string) ??
            (item.rationale as string) ??
            (item.angle as string) ??
            (item.hook as string) ??
            (item.motivation as string) ??
            "";
          return (
            <li key={index} className="rounded-lg border border-border/70 bg-surface/60 px-3 py-2">
              <p className="text-sm font-medium text-foreground">{primary}</p>
              {secondary && <p className="mt-0.5 text-xs text-muted">{secondary}</p>}
              <div className="mt-1 flex flex-wrap gap-1">
                {typeof item.format === "string" && (
                  <Badge variant="outline" className="normal-case">
                    {item.format === "shorts" ? "Short" : "Long-form"}
                  </Badge>
                )}
                {typeof item.difficulty === "string" && (
                  <Badge variant="muted">{item.difficulty} difficulty</Badge>
                )}
                {typeof item.cadence === "string" && (
                  <Badge variant="muted">{item.cadence}</Badge>
                )}
                {typeof item.recommendedFormat === "string" && (
                  <Badge variant="outline" className="normal-case">
                    {item.recommendedFormat}
                  </Badge>
                )}
              </div>
            </li>
          );
        }
        return null;
      })}
    </ul>
  );
}

function EvidenceClassification({ value }: { value: unknown }) {
  if (!isRecord(value)) return null;
  const verified = Array.isArray(value.verified) ? value.verified : [];
  const estimated = Array.isArray(value.estimated) ? value.estimated : [];
  const recommendations = Array.isArray(value.aiRecommendations)
    ? value.aiRecommendations
    : [];
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {[
        {
          label: "Verified facts",
          items: verified,
          icon: CheckCircle2,
          tone: "text-primary",
          border: "border-primary/25",
        },
        {
          label: "Estimates",
          items: estimated,
          icon: CircleDot,
          tone: "text-secondary",
          border: "border-secondary/25",
        },
        {
          label: "AI recommendations",
          items: recommendations,
          icon: Sparkles,
          tone: "text-warning",
          border: "border-warning/25",
        },
      ].map((group) => (
        <div key={group.label} className={`rounded-lg border ${group.border} bg-surface/60 p-3`}>
          <p className={`flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider ${group.tone}`}>
            <group.icon className="size-3" /> {group.label}
          </p>
          <ul className="mt-1.5 space-y-1 text-[11px] leading-relaxed text-muted">
            {group.items.length === 0 ? (
              <li>None recorded.</li>
            ) : (
              group.items.map((item, index) => <li key={index}>{String(item)}</li>)
            )}
          </ul>
        </div>
      ))}
    </div>
  );
}

/**
 * Renders any structured AI report. The report is always visually marked as
 * AI-generated, and evidence classification is shown before the narrative so
 * generated advice is never confused with measured data.
 */
export function ReportView({
  type,
  report,
  provider,
  model,
  createdAt,
}: {
  type: string;
  report: unknown;
  provider?: string | null;
  model?: string | null;
  createdAt?: string | Date | null;
}) {
  if (!isRecord(report)) {
    return (
      <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted">
        This report has no content yet.
      </div>
    );
  }

  const classification = report.evidenceClassification;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className="gap-1 normal-case">
          <Bot className="size-3" /> AI-generated
        </Badge>
        {provider && (
          <Badge variant="outline" className="normal-case">
            {provider}
            {model ? ` · ${model}` : ""}
          </Badge>
        )}
        {createdAt && (
          <span className="text-[11px] text-muted">
            {new Intl.DateTimeFormat("en-US", {
              dateStyle: "medium",
              timeStyle: "short",
              timeZone: "UTC",
            }).format(new Date(createdAt))}
          </span>
        )}
        <span className="ml-auto text-[10px] text-muted">
          Recommendations are not YouTube statistics.
        </span>
      </div>

      {classification ? <EvidenceClassification value={classification} /> : null}

      {"overview" in report && (
        <Section title="Overview">
          <p>{String(report.overview)}</p>
        </Section>
      )}

      {"positioning" in report && (
        <Section title="Positioning">
          <p>{String(report.positioning)}</p>
        </Section>
      )}

      {"audiencePromise" in report && (
        <Section title="Audience promise">
          <p>{String(report.audiencePromise)}</p>
        </Section>
      )}

      {"facelessSuitability" in report && isRecord(report.facelessSuitability) && (
        <Section title="Faceless channel suitability">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-mono text-2xl font-semibold text-primary">
              {String(report.facelessSuitability.score ?? "—")}
              <span className="text-xs text-muted">/100</span>
            </span>
            <p className="flex-1 text-xs leading-relaxed text-muted">
              {String(report.facelessSuitability.rationale ?? "")}
            </p>
          </div>
        </Section>
      )}

      {"targetAudience" in report && (
        <Section title="Target audience">
          <List items={report.targetAudience} />
        </Section>
      )}

      {"audienceProblems" in report && (
        <Section title="Audience problems">
          <List items={report.audienceProblems} />
        </Section>
      )}

      {"subNiches" in report && (
        <Section title="Sub-niche opportunities">
          <List items={report.subNiches} />
        </Section>
      )}

      {"competitionObservations" in report && (
        <Section title="Competition observations">
          <List items={report.competitionObservations} />
        </Section>
      )}

      {"contentFormats" in report && (
        <Section title="Content formats">
          <List items={report.contentFormats} />
        </Section>
      )}

      {"differentiation" in report && (
        <Section title="Differentiation">
          <List items={report.differentiation} />
        </Section>
      )}

      {"videoTopics" in report && (
        <Section title="Suggested video topics">
          <List items={report.videoTopics} />
        </Section>
      )}

      {"ideas" in report && (
        <Section title="Video ideas">
          <List items={report.ideas} />
        </Section>
      )}

      {"observations" in report && (
        <Section title="Observations">
          <List items={report.observations} />
        </Section>
      )}

      {"opportunities" in report && (
        <Section title="Opportunities">
          <List items={report.opportunities} />
        </Section>
      )}

      {"seriesIdeas" in report && (
        <Section title="Series ideas">
          <List items={report.seriesIdeas} />
        </Section>
      )}

      {"cadence" in report && (
        <Section title="Cadence">
          <p>{String(report.cadence)}</p>
        </Section>
      )}

      {"monetization" in report && (
        <Section title="Monetization considerations">
          <List items={report.monetization} />
        </Section>
      )}

      {"firstNinetyDays" in report && (
        <Section title="First 90 days">
          <List items={report.firstNinetyDays} />
        </Section>
      )}

      {"risks" in report && (
        <Section title="Risks">
          <List items={report.risks} />
        </Section>
      )}

      {"nextSteps" in report && (
        <Section title="Recommended next steps">
          <List items={report.nextSteps} />
        </Section>
      )}

      {"notes" in report && (
        <Section title="Notes">
          <List items={report.notes} />
        </Section>
      )}

      {type === "research_report" && (
        <p className="flex items-start gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-[11px] text-muted">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-warning" />
          This report was generated from the evidence stored with it. Re-generate
          after the underlying data refreshes if decisions depend on it.
        </p>
      )}
    </div>
  );
}
