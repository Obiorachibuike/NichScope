"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bookmark, BookmarkCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SaveNicheButton({
  slug,
  initialSaved,
  watchlistId,
  variant = "outline",
  className,
  showLabel = false,
}: {
  slug: string;
  initialSaved: boolean;
  watchlistId?: string;
  variant?: "outline" | "ghost" | "secondary";
  className?: string;
  showLabel?: boolean;
}) {
  const [saved, setSaved] = useState(initialSaved);
  const [id, setId] = useState(watchlistId);
  const [loading, setLoading] = useState(false);
  const [, startTransition] = useTransition();
  const router = useRouter();

  const toggle = async () => {
    if (loading) return;
    setLoading(true);
    try {
      if (saved && id) {
        const response = await fetch(`/api/v1/watchlist/${id}`, { method: "DELETE" });
        if (!response.ok) throw new Error("Unable to remove niche");
        setSaved(false);
        setId(undefined);
        toast.success("Removed from your watchlist");
      } else {
        const response = await fetch("/api/v1/watchlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nicheSlug: slug }),
        });
        const payload = (await response.json()) as {
          data?: { id: string };
          error?: { message: string };
        };
        if (response.status === 409) {
          setSaved(true);
          toast.info("This niche is already saved");
          return;
        }
        if (!response.ok) throw new Error(payload.error?.message ?? "Unable to save niche");
        setSaved(true);
        setId(payload.data?.id);
        toast.success("Saved to your watchlist");
      }
      startTransition(() => router.refresh());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      type="button"
      variant={saved ? "default" : variant}
      size={showLabel ? "sm" : "icon-sm"}
      onClick={() => void toggle()}
      disabled={loading}
      aria-pressed={saved}
      aria-label={saved ? "Remove from watchlist" : "Save niche to watchlist"}
      title={saved ? "Saved — click to remove" : "Save niche"}
      className={cn(showLabel && "gap-1.5", className)}
    >
      {loading ? (
        <Loader2 className="size-4 animate-spin" />
      ) : saved ? (
        <BookmarkCheck className="size-4" />
      ) : (
        <Bookmark className="size-4" />
      )}
      {showLabel && <span>{saved ? "Saved" : "Save niche"}</span>}
    </Button>
  );
}
