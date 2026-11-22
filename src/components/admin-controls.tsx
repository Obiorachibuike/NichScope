"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Play, ShieldAlert, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

export function UserAdminControls({
  userId,
  role,
  status,
  plan,
  isSelf,
}: {
  userId: string;
  role: "user" | "admin";
  status: "active" | "suspended" | "deleted";
  plan: "free" | "pro" | "team";
  isSelf: boolean;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [state, setState] = useState({ role, status, plan });

  const update = async (updates: Partial<typeof state>) => {
    const next = { ...state, ...updates };
    setSaving(true);
    try {
      const response = await fetch(`/api/v1/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      const payload = (await response.json()) as { error?: { message: string } };
      if (!response.ok) throw new Error(payload.error?.message ?? "Update failed");
      setState(next);
      toast.success("User updated");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Update failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Select
        value={state.role}
        onValueChange={(value) => void update({ role: value as "user" | "admin" })}
        disabled={saving || isSelf}
      >
        <SelectTrigger className="h-8 w-[92px] text-xs" aria-label="Role">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="user">user</SelectItem>
          <SelectItem value="admin">admin</SelectItem>
        </SelectContent>
      </Select>
      <Select
        value={state.plan}
        onValueChange={(value) => void update({ plan: value as "free" | "pro" | "team" })}
        disabled={saving}
      >
        <SelectTrigger className="h-8 w-[84px] text-xs" aria-label="Plan">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="free">free</SelectItem>
          <SelectItem value="pro">pro</SelectItem>
          <SelectItem value="team">team</SelectItem>
        </SelectContent>
      </Select>
      <Select
        value={state.status}
        onValueChange={(value) => void update({ status: value as "active" | "suspended" | "deleted" })}
        disabled={saving || isSelf}
      >
        <SelectTrigger className="h-8 w-[104px] text-xs" aria-label="Status">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="active">active</SelectItem>
          <SelectItem value="suspended">suspended</SelectItem>
          <SelectItem value="deleted">deleted</SelectItem>
        </SelectContent>
      </Select>
      {saving && <Loader2 className="size-3.5 animate-spin text-muted" />}
    </div>
  );
}

export function PermissionControls({
  sourceId,
  sourceType,
  scope,
  status,
  gateBlocked,
}: {
  sourceId: string;
  sourceType: string;
  scope: string;
  status: "approved" | "denied" | "pending";
  gateBlocked?: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [approvalRef, setApprovalRef] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const update = async (nextStatus: "approved" | "denied" | "pending") => {
    setSaving(true);
    try {
      const response = await fetch(`/api/v1/admin/data-sources/${sourceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope,
          status: nextStatus,
          approvalRef: nextStatus === "approved" ? approvalRef.trim() || null : null,
          notes: notes.trim() || null,
        }),
      });
      const payload = (await response.json()) as { error?: { message: string } };
      if (!response.ok) throw new Error(payload.error?.message ?? "Update failed");
      toast.success(`Permission ${nextStatus}`);
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Update failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center justify-end gap-1">
      <span className="mr-1">
        <StatusPill status={status} />
      </span>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Approve ${scope}`}
            title="Approve scope"
            disabled={saving}
          >
            <Check className="size-3.5" />
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record approval for “{scope.replaceAll("_", " ")}”</DialogTitle>
            <DialogDescription>
              Approvals are auditable. {sourceType === "youtube_api"
                ? "YouTube aggregation additionally requires the deployment flag YOUTUBE_ANALYTICS_APPROVAL_STATUS=approved and a written approval reference."
                : "Licensed provider scopes require an active contract reference and LICENSED_DATA_PROVIDER_ENABLED=true."}
            </DialogDescription>
          </DialogHeader>
          {gateBlocked && (
            <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/[0.05] px-3 py-2 text-xs text-warning">
              <ShieldAlert className="mt-0.5 size-3.5 shrink-0" />
              {gateBlocked}
            </div>
          )}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor={`ref-${sourceId}-${scope}`}>Approval / contract reference</Label>
              <Input
                id={`ref-${sourceId}-${scope}`}
                value={approvalRef}
                onChange={(event) => setApprovalRef(event.target.value)}
                placeholder="e.g. YT-APPROVAL-2026-014 or contract #A-1182"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`notes-${sourceId}-${scope}`}>Notes (optional)</Label>
              <Textarea
                id={`notes-${sourceId}-${scope}`}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={2}
                placeholder="Scope limitations, expiry, conditions…"
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost" type="button">Cancel</Button>
            </DialogClose>
            <Button type="button" onClick={() => void update("approved")} disabled={saving}>
              {saving && <Loader2 className="size-3.5 animate-spin" />} Approve scope
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Deny ${scope}`}
        title="Deny scope"
        disabled={saving || status === "denied"}
        onClick={() => void update("denied")}
        className="text-muted hover:text-danger"
      >
        <X className="size-3.5" />
      </Button>
    </div>
  );
}

export function StatusPill({ status }: { status: string }) {
  const tone =
    status === "approved"
      ? "border-success/30 bg-success/10 text-success"
      : status === "denied"
        ? "border-danger/30 bg-danger/10 text-danger"
        : "border-warning/30 bg-warning/10 text-warning";
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize ${tone}`}>
      {status}
    </span>
  );
}

export function JobLauncher({ jobs }: { jobs: readonly string[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState(jobs[0] ?? "");
  const [payload, setPayload] = useState("");
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    try {
      let parsedPayload: Record<string, unknown> = {};
      if (payload.trim()) {
        try {
          parsedPayload = JSON.parse(payload) as Record<string, unknown>;
        } catch {
          throw new Error("Payload must be valid JSON");
        }
      }
      const response = await fetch("/api/v1/admin/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: selected, payload: parsedPayload }),
      });
      const body = (await response.json()) as {
        error?: { message: string };
        meta?: { deduplicated: boolean };
      };
      if (!response.ok) throw new Error(body.error?.message ?? "Unable to enqueue job");
      toast.success(
        body.meta?.deduplicated
          ? "An identical job already exists — deduplicated"
          : "Job queued",
      );
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to enqueue job");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Select value={selected} onValueChange={setSelected}>
          <SelectTrigger className="sm:w-64" aria-label="Job name">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {jobs.map((job) => (
              <SelectItem key={job} value={job}>{job}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="button" onClick={() => void run()} disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
          Enqueue job
        </Button>
      </div>
      <Textarea
        value={payload}
        onChange={(event) => setPayload(event.target.value)}
        placeholder='Optional JSON payload, e.g. {"query":"ai agents","type":"video"}'
        rows={2}
        className="font-mono text-[11px]"
      />
      <p className="text-[10px] text-muted">
        Jobs run in the dedicated worker (or the embedded runner when enabled). Payloads
        are validated per job; AI report jobs need a userId and nicheSlug.
      </p>
    </div>
  );
}
