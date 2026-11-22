"use client";

import { useState } from "react";
import { AlertCircle, Bot, Loader2, Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ReportView } from "@/components/report-view";
import { ComplianceNote } from "@/components/data-badges";

const REPORT_TYPES = [
  { value: "niche_analysis", label: "Niche analysis" },
  { value: "research_report", label: "Full research report" },
  { value: "subniches", label: "Sub-niche opportunities" },
  { value: "video_ideas", label: "Video ideas" },
  { value: "competition", label: "Competition analysis" },
  { value: "channel_strategy", label: "Channel strategy" },
];

interface ApiResponse {
  data?: {
    reportId: string;
    provider: string;
    model: string;
    isFallback: boolean;
    offlineFixture: boolean;
    content: unknown;
    usage: { usedToday: number; limit: number; remaining: number; costToday: number };
    evidence?: unknown;
  };
  error?: { message: string; code?: string };
}

export function AiAdvisorForm({
  niches,
  nicheSlug,
  initialType = "niche_analysis",
  usage,
  fixedNiche = false,
  existingReport,
}: {
  niches?: { slug: string; name: string; categoryName?: string }[];
  nicheSlug?: string;
  initialType?: string;
  usage?: { usedToday: number; limit: number; remaining: number };
  fixedNiche?: boolean;
  existingReport?: {
    type: string;
    report: unknown;
    provider?: string | null;
    model?: string | null;
    createdAt?: string | Date | null;
    title?: string;
  } | null;
}) {
  const [selectedNiche, setSelectedNiche] = useState(
    nicheSlug ?? niches?.[0]?.slug ?? "",
  );
  const [type, setType] = useState(existingReport?.type ?? initialType);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    provider: string;
    model: string;
    isFallback: boolean;
    offlineFixture: boolean;
    content: unknown;
    createdAt: string;
    usage?: { usedToday: number; limit: number; remaining: number };
  } | null>(
    existingReport
      ? {
          provider: existingReport.provider ?? "stored report",
          model: existingReport.model ?? "",
          isFallback: false,
          offlineFixture: existingReport.provider === "fixture",
          content: existingReport.report,
          createdAt: String(existingReport.createdAt ?? ""),
        }
      : null,
  );
  const [usageState, setUsageState] = useState(usage);

  const run = async () => {
    if (!selectedNiche) {
      setError("Choose a niche first.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/v1/ai/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nicheSlug: selectedNiche,
          type,
          prompt: prompt.trim() || undefined,
        }),
      });
      const payload = (await response.json()) as ApiResponse;
      if (!response.ok || !payload.data) {
        throw new Error(payload.error?.message ?? "The report could not be generated");
      }
      setResult({
        provider: payload.data.provider,
        model: payload.data.model,
        isFallback: payload.data.isFallback,
        offlineFixture: payload.data.offlineFixture,
        content: payload.data.content,
        createdAt: new Date().toISOString(),
        usage: payload.data.usage,
      });
      setUsageState(payload.data.usage);
      toast.success("Report generated");
    } catch (runError) {
      const message =
        runError instanceof Error ? runError.message : "The report could not be generated";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]">
        {!fixedNiche && (
          <div className="space-y-1.5">
            <Label htmlFor="ai-niche">Niche</Label>
            <Select value={selectedNiche} onValueChange={setSelectedNiche}>
              <SelectTrigger id="ai-niche">
                <SelectValue placeholder="Select a niche" />
              </SelectTrigger>
              <SelectContent>
                {(niches ?? []).map((niche) => (
                  <SelectItem key={niche.slug} value={niche.slug}>
                    {niche.name}
                    {niche.categoryName ? ` · ${niche.categoryName}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="ai-type">Report type</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger id="ai-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REPORT_TYPES.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="ai-prompt">Additional context (optional)</Label>
        <Textarea
          id="ai-prompt"
          value={prompt}
          maxLength={2000}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="e.g. I want a faceless channel with 2 videos per week and a $200 production budget."
          rows={2}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={() => void run()} disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Generating…
            </>
          ) : (
            <>
              <Wand2 className="size-4" /> Generate report
            </>
          )}
        </Button>
        {usageState && (
          <span className="text-[11px] text-muted">
            {usageState.remaining} of {usageState.limit} AI reports remaining today
          </span>
        )}
        {result?.offlineFixture && (
          <Badge variant="warning" className="gap-1">
            Offline fixture generator
          </Badge>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/[0.06] px-3 py-2 text-xs text-danger"
        >
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!result && !loading && (
        <div className="rounded-xl border border-dashed border-border bg-surface/60 p-8 text-center">
          <Bot className="mx-auto size-7 text-muted" />
          <p className="mt-3 text-sm font-medium">Evidence-grounded research</p>
          <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-muted">
            The advisor only receives data you are permitted to see. Verified facts,
            estimates and recommendations stay separated in the output.
          </p>
        </div>
      )}

      {loading && (
        <div className="space-y-3 rounded-xl border border-border bg-card p-5">
          <div className="h-3 w-1/3 rounded bg-card-elevated" />
          <div className="h-3 w-full rounded bg-card-elevated" />
          <div className="h-3 w-5/6 rounded bg-card-elevated" />
          <div className="h-3 w-2/3 rounded bg-card-elevated" />
        </div>
      )}

      {result && !loading && (
        <div className="rounded-xl border border-border bg-card p-5">
          <ReportView
            type={type}
            report={result.content}
            provider={result.provider}
            model={result.model}
            createdAt={result.createdAt}
          />
          {result.offlineFixture && (
            <ComplianceNote className="mt-4">
              This deployment has no AI credentials, so the deterministic offline
              fixture generator produced this report. Configure AGNES_API_KEY (or
              OPENAI_API_KEY) to use a language model. The fixture never invents
              statistics.
            </ComplianceNote>
          )}
          {result.isFallback && !result.offlineFixture && (
            <p className="mt-3 flex items-center gap-1.5 text-[11px] text-warning">
              <Sparkles className="size-3" /> The primary provider failed, so a
              fallback provider generated this report.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
