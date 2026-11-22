"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Loader2, NotebookPen, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

export function WatchlistActions({
  watchlistId,
  name,
  notes,
}: {
  watchlistId: string;
  name: string;
  notes: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(notes ?? "");
  const [loading, setLoading] = useState(false);

  const saveNotes = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/v1/watchlist/${watchlistId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: value.trim() || null }),
      });
      const payload = (await response.json()) as { error?: { message: string } };
      if (!response.ok) throw new Error(payload.error?.message ?? "Unable to save notes");
      toast.success("Notes updated");
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save notes");
    } finally {
      setLoading(false);
    }
  };

  const remove = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/v1/watchlist/${watchlistId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const payload = (await response.json()) as { error?: { message: string } };
        throw new Error(payload.error?.message ?? "Unable to remove");
      }
      toast.success("Removed from watchlist");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to remove");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-1">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Edit notes for ${name}`} title="Edit notes">
            <NotebookPen className="size-3.5" />
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Notes for {name}</DialogTitle>
            <DialogDescription>
              Notes are private to your account and are not sent to AI providers unless
              you include them in a report prompt.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="watchlist-notes">Notes</Label>
            <Textarea
              id="watchlist-notes"
              value={value}
              maxLength={2000}
              rows={5}
              onChange={(event) => setValue(event.target.value)}
              placeholder="Why is this niche on your list? What is the next test?"
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost" type="button">Cancel</Button>
            </DialogClose>
            <Button type="button" onClick={() => void saveNotes()} disabled={loading}>
              {loading && <Loader2 className="size-3.5 animate-spin" />} Save notes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Remove ${name} from watchlist`}
        title="Remove"
        onClick={() => void remove()}
        disabled={loading}
        className="text-muted hover:text-danger"
      >
        <Trash2 className="size-3.5" />
      </Button>
    </div>
  );
}

export function DeleteSavedSearchButton({ id }: { id: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label="Delete saved search"
      title="Delete saved search"
      disabled={loading}
      onClick={async () => {
        setLoading(true);
        try {
          const response = await fetch(`/api/v1/saved-searches?id=${id}`, {
            method: "DELETE",
          });
          if (!response.ok) throw new Error("Unable to delete saved search");
          toast.success("Saved search deleted");
          router.refresh();
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Unable to delete");
        } finally {
          setLoading(false);
        }
      }}
    >
      {loading ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
    </Button>
  );
}

export function ExportReportButton({ reportId }: { reportId: string }) {
  const [loading, setLoading] = useState(false);
  return (
    <Button
      variant="secondary"
      size="sm"
      disabled={loading}
      onClick={async () => {
        setLoading(true);
        try {
          const response = await fetch(`/api/v1/ai/reports/${reportId}`);
          if (!response.ok) throw new Error("Unable to load report");
          const payload = (await response.json()) as { data: { report: { report: unknown } } };
          const blob = new Blob([JSON.stringify(payload.data.report.report, null, 2)], {
            type: "application/json",
          });
          const url = URL.createObjectURL(blob);
          const anchor = document.createElement("a");
          anchor.href = url;
          anchor.download = `nichscope-report-${reportId}.json`;
          anchor.click();
          URL.revokeObjectURL(url);
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Unable to export");
        } finally {
          setLoading(false);
        }
      }}
    >
      <FileText className="size-3.5" /> Export JSON
    </Button>
  );
}
