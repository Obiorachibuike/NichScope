"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CloudDownload, Loader2, PlaySquare } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

export function LiveLookupPanel({
  type,
  nicheId,
}: {
  type: "video" | "channel";
  nicheId?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState("");
  const [language, setLanguage] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState<{
    videos?: number;
    channels?: number;
    fromCache?: boolean;
    quotaUnits?: number;
  } | null>(null);

  const run = async () => {
    if (query.trim().length < 2) {
      toast.error("Enter at least 2 characters");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/v1/youtube/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: query.trim(),
          type,
          regionCode: region ? region.toUpperCase() : undefined,
          relevanceLanguage: language || undefined,
          nicheId,
        }),
      });
      const payload = (await response.json()) as {
        data?: { videos?: number; channels?: number; fromCache?: boolean; quotaUnits?: number };
        error?: { message: string };
      };
      if (!response.ok) throw new Error(payload.error?.message ?? "Lookup failed");
      setLastResult(payload.data ?? null);
      toast.success(
        `Stored ${payload.data?.videos ?? payload.data?.channels ?? 0} ${type} records from the YouTube Data API`,
      );
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Lookup failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary">
          <PlaySquare className="size-4" /> Fetch live {type === "video" ? "videos" : "channels"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Live YouTube lookup</DialogTitle>
          <DialogDescription>
            Queries the official YouTube Data API once and stores individual public
            records. A search call costs 100 quota units; cached responses are free.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="lookup-query">Search query</Label>
            <Input
              id="lookup-query"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={type === "video" ? "e.g. ai agents tutorial" : "e.g. AI Agents Lab"}
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="lookup-region">Region (optional)</Label>
              <Input
                id="lookup-region"
                value={region}
                maxLength={2}
                onChange={(event) => setRegion(event.target.value)}
                placeholder="US"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lookup-language">Language (optional)</Label>
              <Input
                id="lookup-language"
                value={language}
                maxLength={5}
                onChange={(event) => setLanguage(event.target.value)}
                placeholder="en"
              />
            </div>
          </div>
          {lastResult && (
            <div className="rounded-lg border border-border bg-surface px-3 py-2 text-xs text-muted">
              <Badge variant="success" className="mr-2">Stored</Badge>
              {lastResult.videos ?? lastResult.channels ?? 0} records ·{" "}
              {lastResult.fromCache ? "served from cache" : `${lastResult.quotaUnits ?? 0} quota units spent`}
            </div>
          )}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost" type="button">Close</Button>
          </DialogClose>
          <Button type="button" onClick={() => void run()} disabled={loading}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : <CloudDownload className="size-4" />}
            {loading ? "Fetching…" : "Fetch and store"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
