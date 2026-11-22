import type { Metadata } from "next";
import Link from "next/link";
import { Check, CreditCard, Info } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScoreBar } from "@/components/score-bar";
import { requireUser, getUserProfile } from "@/lib/auth/session";
import { getReadyDb } from "@/lib/db/ready";
import { getAiUsage } from "@/lib/services/ai";
import { formatDate, titleCase } from "@/lib/utils";

export const metadata: Metadata = { title: "Subscription & Billing" };
export const dynamic = "force-dynamic";

const PLANS = [
  {
    key: "free",
    name: "Free",
    price: "$0",
    blurb: "Validate your first niche.",
    features: [
      "Full taxonomy search",
      "5 watchlist niches",
      "3 AI reports / day",
      "Eligible global rankings",
    ],
    aiLimit: 3,
  },
  {
    key: "pro",
    name: "Pro",
    price: "$29",
    blurb: "Build a channel strategy.",
    features: [
      "Unlimited watchlists",
      "Unlimited saved searches",
      "50 AI reports / day",
      "Full report library",
    ],
    aiLimit: 50,
  },
  {
    key: "team",
    name: "Team",
    price: "$99",
    blurb: "Research at agency scale.",
    features: [
      "Everything in Pro",
      "200 AI reports / day",
      "Admin governance tools",
      "Audit logs and health monitoring",
    ],
    aiLimit: 200,
  },
] as const;

export default async function BillingPage() {
  const user = await requireUser("/billing");
  const { subscription } = await getUserProfile(user.id);
  const db = await getReadyDb();
  const usage = await getAiUsage(db, user.id, user.plan);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={
          <>
            <span>Workspace</span>
            <span className="text-border-strong">/</span>
            <span>Subscription</span>
          </>
        }
        title="Subscription & Billing"
        description="Plan entitlements are enforced server-side. This deployment has no payment provider connected, so no charges can be made."
        actions={<Badge variant="outline" className="normal-case">{titleCase(user.plan)} plan</Badge>}
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="size-4 text-primary" /> Current subscription
            </CardTitle>
            <CardDescription>
              {subscription
                ? `${titleCase(subscription.plan)} · ${titleCase(subscription.status)} · ${subscription.provider}`
                : "No subscription record is attached to this account."}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <PlanInfo label="Plan" value={titleCase(subscription?.plan ?? user.plan)} />
            <PlanInfo label="Status" value={titleCase(subscription?.status ?? "active")} />
            <PlanInfo label="Renews" value={formatDate(subscription?.currentPeriodEnd)} />
            <PlanInfo label="Seats" value={String(subscription?.seats ?? 1)} />
            <PlanInfo label="Provider" value={titleCase(subscription?.provider ?? "manual")} />
            <PlanInfo label="Cancel at period end" value={subscription?.cancelAtPeriodEnd ? "Yes" : "No"} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">AI allowance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-semibold tabular-nums">{usage.usedToday}</span>
              <span className="text-xs text-muted">of {usage.limit} today</span>
            </div>
            <ScoreBar score={(usage.usedToday / Math.max(1, usage.limit)) * 100} showLabel={false} />
            <p className="text-[11px] text-muted">{usage.remaining} reports remaining today.</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {PLANS.map((plan) => {
          const current = plan.key === user.plan;
          return (
            <Card
              key={plan.key}
              className={current ? "border-primary/40 shadow-glow" : undefined}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm uppercase tracking-wide text-muted">
                    {plan.name}
                  </CardTitle>
                  {current && <Badge>Current</Badge>}
                </div>
                <p className="mt-1 flex items-baseline gap-1">
                  <span className="text-3xl font-semibold tracking-tight">{plan.price}</span>
                  <span className="text-xs text-muted">/ month</span>
                </p>
                <CardDescription>{plan.blurb}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <ul className="space-y-1.5 text-xs">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-muted-strong">
                      <Check className="mt-0.5 size-3.5 shrink-0 text-primary" /> {feature}
                    </li>
                  ))}
                </ul>
                <Button
                  variant={current ? "secondary" : "default"}
                  className="w-full"
                  disabled
                  title="Payment provider not configured"
                >
                  {current ? "Current plan" : "Upgrade requires billing setup"}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-border bg-surface px-4 py-3 text-xs leading-relaxed text-muted">
        <Info className="mt-0.5 size-4 shrink-0" />
        <div>
          <p className="font-medium text-muted-strong">Billing integration status</p>
          <p className="mt-1">
            No payment provider is configured in this deployment, so plan changes are
            disabled rather than simulated. An administrator can set entitlement plans
            from the admin dashboard for approved accounts. Data-source availability is
            never unlocked by plan tier — it is governed by compliance approvals.
          </p>
          <p className="mt-1">
            Questions about licensing or invoicing should go to your deployment
            administrator.{" "}
            <Link href="/settings" className="text-primary hover:underline">
              Account settings
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function PlanInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/70 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-muted-strong">{value}</p>
    </div>
  );
}
