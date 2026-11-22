"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { AlertTriangle, Loader2, Save, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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

interface Preferences {
  emailDigest?: boolean;
  defaultPeriod?: "7d" | "30d" | "90d";
  defaultCountry?: string;
}

export function ProfileSettingsForm({
  name,
  email,
  preferences,
}: {
  name: string | null;
  email: string;
  preferences: Preferences;
}) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(name ?? "");
  const [emailDigest, setEmailDigest] = useState(preferences.emailDigest ?? false);
  const [defaultPeriod, setDefaultPeriod] = useState<"7d" | "30d" | "90d">(
    preferences.defaultPeriod ?? "30d",
  );
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const response = await fetch("/api/v1/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: displayName.trim() || undefined,
          preferences: { emailDigest, defaultPeriod },
        }),
      });
      const payload = (await response.json()) as { error?: { message: string } };
      if (!response.ok) throw new Error(payload.error?.message ?? "Unable to save settings");
      toast.success("Settings saved");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="settings-name">Display name</Label>
          <Input
            id="settings-name"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            maxLength={80}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="settings-email">Email</Label>
          <Input id="settings-email" value={email} readOnly disabled />
          <p className="text-[11px] text-muted">Email changes are not enabled in this release.</p>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="settings-period">Default ranking window</Label>
        <Select
          value={defaultPeriod}
          onValueChange={(value) => setDefaultPeriod(value as "7d" | "30d" | "90d")}
        >
          <SelectTrigger id="settings-period" className="sm:w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">7 days</SelectItem>
            <SelectItem value="30d">30 days</SelectItem>
            <SelectItem value="90d">90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2.5">
        <div>
          <p className="text-sm font-medium">Email research digest</p>
          <p className="text-[11px] text-muted">
            Reserved for the weekly summary email. Delivery is not configured in this deployment.
          </p>
        </div>
        <Switch checked={emailDigest} onCheckedChange={setEmailDigest} aria-label="Email digest" />
      </div>

      <Button type="button" onClick={() => void save()} disabled={saving}>
        {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
        Save changes
      </Button>
    </div>
  );
}

export function DeleteAccountDialog({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);

  const remove = async () => {
    if (confirmation !== "DELETE") {
      toast.error('Type DELETE to confirm');
      return;
    }
    setDeleting(true);
    try {
      const response = await fetch("/api/v1/account", { method: "DELETE" });
      if (!response.ok) {
        const payload = (await response.json()) as { error?: { message: string } };
        throw new Error(payload.error?.message ?? "Unable to delete account");
      }
      toast.success("Account deleted");
      await signOut({ callbackUrl: "/" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete account");
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm">
          <ShieldAlert className="size-4" /> Delete account
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-danger" /> Delete your account
          </DialogTitle>
          <DialogDescription>
            This permanently removes your watchlists, saved searches, AI reports,
            connected accounts and sessions. Audit records are retained without a linked
            personal identifier. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="delete-confirmation">Type DELETE to confirm</Label>
          <Input
            id="delete-confirmation"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            placeholder="DELETE"
          />
          <p className="text-[11px] text-muted">Signed in as {email}</p>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost" type="button">Cancel</Button>
          </DialogClose>
          <Button
            variant="destructive"
            type="button"
            onClick={() => void remove()}
            disabled={deleting}
          >
            {deleting && <Loader2 className="size-3.5 animate-spin" />}
            Delete permanently
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
