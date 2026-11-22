import type { Metadata } from "next";
import Link from "next/link";
import { KeyRound, ShieldCheck, Sparkles, UserRound } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import {
  DeleteAccountDialog,
  ProfileSettingsForm,
} from "@/components/settings-forms";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScoreBar } from "@/components/score-bar";
import { requireUser, getUserProfile } from "@/lib/auth/session";
import { getReadyDb } from "@/lib/db/ready";
import { getAiUsage } from "@/lib/services/ai";
import { formatDate, titleCase } from "@/lib/utils";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const sessionUser = await requireUser("/settings");
  const { user, subscription } = await getUserProfile(sessionUser.id);
  const db = await getReadyDb();
  const usage = await getAiUsage(db, sessionUser.id, sessionUser.plan);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={
          <>
            <span>Workspace</span>
            <span className="text-border-strong">/</span>
            <span>Account</span>
          </>
        }
        title="Settings"
        description="Manage your profile, research defaults, AI usage and account data."
        actions={
          <Badge variant="outline" className="normal-case">
            {titleCase(sessionUser.role)} · {sessionUser.plan} plan
          </Badge>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <UserRound className="size-4 text-primary" /> Profile & preferences
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ProfileSettingsForm
                name={user?.name ?? null}
                email={user?.email ?? sessionUser.email}
                preferences={(user?.preferences ?? {}) as {
                  emailDigest?: boolean;
                  defaultPeriod?: "7d" | "30d" | "90d";
                }}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="size-4 text-primary" /> Security
              </CardTitle>
              <CardDescription>
                Sessions are JWTs in secure, http-only cookies with a 30-day lifetime.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between border-b border-border/60 pb-2">
                <span className="text-muted">Password login</span>
                <Badge variant="success">Enabled</Badge>
              </div>
              <div className="flex items-center justify-between border-b border-border/60 pb-2">
                <span className="text-muted">Google OAuth</span>
                <Badge variant="muted">Configured per deployment</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted">Last sign-in</span>
                <span className="text-xs text-muted-strong">
                  {formatDate(user?.lastLoginAt ?? user?.createdAt)}
                </span>
              </div>
              <p className="rounded-lg border border-border bg-surface px-3 py-2 text-[11px] leading-relaxed text-muted">
                OAuth provider tokens are encrypted at rest (AES-256-GCM). API keys never
                reach the browser. Sign out to invalidate the session cookie on this
                device.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="size-4 text-primary" /> AI usage
              </CardTitle>
              <CardDescription>
                Daily limits depend on your plan and are enforced server-side.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-semibold tabular-nums">{usage.usedToday}</span>
                <span className="text-xs text-muted">of {usage.limit} reports today</span>
              </div>
              <ScoreBar score={(usage.usedToday / Math.max(1, usage.limit)) * 100} showLabel={false} />
              <p className="text-[11px] text-muted">
                {usage.remaining} remaining · ${usage.costToday.toFixed(4)} estimated model
                cost today · cap ${usage.costCapUsd.toFixed(2)}
              </p>
              <Button asChild variant="ghost" size="sm" className="px-0">
                <Link href="/billing">Compare plans for higher limits →</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="border-danger/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base text-danger">
                <KeyRound className="size-4" /> Data & account deletion
              </CardTitle>
              <CardDescription>
                You can delete your account at any time. Doing so removes personal data
                and all research artefacts.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center justify-between gap-3">
              <p className="max-w-md text-[11px] leading-relaxed text-muted">
                Watchlists, saved searches, AI reports and connected accounts are
                deleted immediately. Audit records keep operational accountability
                without a linked user identifier.
              </p>
              <DeleteAccountDialog email={sessionUser.email} />
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Account</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <Row label="Plan" value={titleCase(sessionUser.plan)} />
              <Row label="Role" value={titleCase(sessionUser.role)} />
              <Row label="Status" value={titleCase(sessionUser.status)} />
              <Row label="Member since" value={formatDate(user?.createdAt)} />
              <Row
                label="Subscription"
                value={
                  subscription
                    ? `${titleCase(subscription.plan)} · ${titleCase(subscription.status)}`
                    : "No subscription record"
                }
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Privacy notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-[11px] leading-relaxed text-muted">
              <p>NicheScope stores only the public YouTube metadata you request.</p>
              <p>Public YouTube records are deleted at the 30-day policy boundary.</p>
              <p>
                AI providers receive only the evidence attached to your report and never
                your password or session token.
              </p>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-2 border-b border-border/50 pb-2 last:border-0 last:pb-0">
      <span className="text-muted">{label}</span>
      <span className="text-right font-medium text-muted-strong">{value}</span>
    </div>
  );
}
