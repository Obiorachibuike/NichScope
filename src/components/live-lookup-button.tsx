"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CloudDownload, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/**
 * Explicit live lookup. Quota is only spent when the user asks for fresh
 * YouTube data, and the server enforces quota + retention regardless.
 */
export function LiveLookupButton({
  slug,
  kind,
  label,
  query,
}: {
  slug: string;
  kind: "videos" | "channels";
  label?: string;
  query?: string;
}) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const lookup = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ live: "1" });
      if (query) params.set("q", query);
      const response = await fetch(
        `/api/v1/niches/${encodeURIComponent(slug)}/${kind}?${params.toString()}`,
      );
      const payload = (await response.json()) as {
        meta?: { live?: { videos?: number; channels?: number; fromCache?: boolean } };
        error?: { message: string };
      };
      if (!response.ok) throw new Error(payload.error?.message ?? "Lookup failed");
      const live = payload.meta?.live;
      const count = live?.videos ?? live?.channels ?? 0;
      toast.success(
        live?.fromCache
          ? `Served ${count} records from the compliant cache`
          : `Fetched ${count} ${kind} from the YouTube Data API`,
      );
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Lookup failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button type="button" variant="secondary" size="sm" onClick={() => void lookup()} disabled={loading}>
      {loading ? <Loader2 className="size-3.5 animate-spin" /> : <CloudDownload className="size-3.5" />}
      {label ?? `Fetch live ${kind}`}
    </Button>
  );
}
