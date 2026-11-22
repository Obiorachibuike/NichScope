import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Bookmark,
  BrainCircuit,
  Check,
  Compass,
  Database,
  FlaskConical,
  Globe2,
  Layers,
  LineChart,
  ListFilter,
  Lock,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  PlaySquare,
  Tv,
  Film,
  Zap,
} from "lucide-react";
import { MarketingFooter, MarketingHeader } from "@/components/marketing/header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getSessionUser } from "@/lib/auth/session";
import { formatNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

const FEATURES = [
  {
    icon: Compass,
    title: "Hierarchical niche taxonomy",
    description:
      "16 categories, 140+ niches and sub-niches with aliases and keyword maps — maintained independently of YouTube data.",
  },
  {
    icon: ListFilter,
    title: "Composable filtering",
    description:
      "Combine category, format, competition, growth, monetization, country, language and score filters. Every filter hits real records.",
  },
  {
    icon: LineChart,
    title: "Transparent opportunity scoring",
    description:
      "A documented, versioned model: growth 25%, channel growth 20%, performance 20%, competition 20%, engagement 10%, consistency 5%.",
  },
  {
    icon: PlaySquare,
    title: "Official YouTube Data API",
    description:
      "Server-side search, channel and video lookups with quota tracking, caching, retries and 30-day retention enforcement.",
  },
  {
    icon: BrainCircuit,
    title: "AI advisor with evidence",
    description:
      "Agnes AI (with OpenAI fallback) turns permitted evidence into positioning, formats and video ideas — never invented statistics.",
  },
  {
    icon: Bookmark,
    title: "Watchlists and alerts",
    description:
      "Save niches, notes and searches. Monitor eligible ranking or metric changes with per-user ownership checks.",
  },
  {
    icon: ShieldCheck,
    title: "Compliance by architecture",
    description:
      "Permitted-use evaluation runs server-side. Aggregation or cross-channel rankings stay disabled without written approval.",
  },
  {
    icon: Database,
    title: "Provenance on every metric",
    description:
      "Source, confidence, scoring version, measurement window and calculation timestamp travel with every value.",
  },
];

const STEPS = [
  {
    title: "Explore the taxonomy",
    description:
      "Start from a category or search a keyword. Filter by format, competition and growth to shortlist niches.",
    icon: Search,
  },
  {
    title: "Validate with real research",
    description:
      "Open individual channels and videos through the official API. Every statistic carries its source and retrieval time.",
    icon: PlaySquare,
  },
  {
    title: "Score and compare",
    description:
      "Compare opportunity scores built only from eligible sources, with weights and inputs visible in the explanation.",
    icon: BarChart3,
  },
  {
    title: "Plan with the AI advisor",
    description:
      "Generate audience, positioning and video-idea reports grounded in permitted evidence — clearly separated from data.",
    icon: Sparkles,
  },
];

const PLANS = [
  {
    name: "Free",
    price: "$0",
    cadence: "forever",
    description: "For creators validating their first niche.",
    features: [
      "Full taxonomy and keyword search",
      "Niche and sub-niche explorer",
      "1 saved search and 5 watchlist niches",
      "3 AI reports per day",
      "Global rankings when a source is eligible",
    ],
    cta: "Start free",
    href: "/register",
    highlight: false,
  },
  {
    name: "Pro",
    price: "$29",
    cadence: "per month",
    description: "For creators shipping a channel strategy.",
    features: [
      "Everything in Free",
      "50 AI reports per day",
      "Unlimited watchlists and saved searches",
      "Channel and video research history",
      "Priority live YouTube lookups",
    ],
    cta: "Choose Pro",
    href: "/register",
    highlight: true,
  },
  {
    name: "Team",
    price: "$99",
    cadence: "per month",
    description: "For agencies and research teams.",
    features: [
      "Everything in Pro",
      "200 AI reports per day",
      "Admin dashboard and audit logs",
      "Data source governance controls",
      "Operational health and quota monitoring",
    ],
    cta: "Choose Team",
    href: "/register",
    highlight: false,
  },
];

const FAQS = [
  {
    q: "Does NicheScope scrape YouTube?",
    a: "No. All YouTube data comes from the official YouTube Data API v3 through documented endpoints. NicheScope never scrapes pages, never downloads audiovisual content and never bypasses API quotas.",
  },
  {
    q: "Where do niche rankings come from?",
    a: "Only from data sources whose permissions allow ranking. The public YouTube API does not permit cross-channel aggregate rankings without written approval, so those scopes ship disabled. A separately licensed analytics provider can be enabled per deployment with recorded contract scopes.",
  },
  {
    q: "What happens without a licensed data provider?",
    a: "The product still works: taxonomy exploration, keyword search, individual channel and video research, watchlists and evidence-based AI analysis. Ranking surfaces show an explicit empty state instead of invented numbers.",
  },
  {
    q: "How fresh is the data?",
    a: "Every record shows its retrieval time. Public YouTube data is cached briefly to reduce quota use, refreshed on a schedule and hard-deleted after the 30-day policy window by the retention worker.",
  },
  {
    q: "Can I see which numbers are estimates?",
    a: "Yes. Confidence, source name, measurement window and scoring version are attached to metrics. AI output is separated into verified facts, estimates and recommendations.",
  },
];

export default async function LandingPage() {
  const user = await getSessionUser();

  let taxonomyStats = { niches: 145, categories: 16, keywords: 800 };
  try {
    const { getReadyDb } = await import("@/lib/db/ready");
    const { niches, categories, nicheKeywords } = await import("@/lib/db/schema");
    const { count } = await import("drizzle-orm");
    const db = await getReadyDb();
    const [[nicheCount], [categoryCount], [keywordCount]] = await Promise.all([
      db.select({ value: count() }).from(niches),
      db.select({ value: count() }).from(categories),
      db.select({ value: count() }).from(nicheKeywords),
    ]);
    taxonomyStats = {
      niches: Number(nicheCount?.value ?? taxonomyStats.niches),
      categories: Number(categoryCount?.value ?? taxonomyStats.categories),
      keywords: Number(keywordCount?.value ?? taxonomyStats.keywords),
    };
  } catch {
    // The marketing page must render even if the database is not reachable.
  }

  return (
    <div className="min-h-dvh bg-background">
      <MarketingHeader signedIn={Boolean(user)} />

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="pointer-events-none absolute inset-0 bg-radial-brand" />
        <div className="pointer-events-none absolute inset-0 bg-grid opacity-[0.25] [mask-image:radial-gradient(ellipse_at_top,black,transparent_72%)]" />
        <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-16 sm:px-6 sm:pt-24">
          <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="animate-slide-up">
              <Badge variant="outline" className="gap-1.5 border-primary/25 bg-primary-soft/40 text-primary normal-case">
                <Sparkles className="size-3" />
                Niche discovery for creators who check the data
              </Badge>
              <h1 className="mt-5 text-balance text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl lg:text-[56px]">
                Find Your Next{" "}
                <span className="gradient-text">Winning YouTube Niche.</span>
              </h1>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
                Discover growing YouTube niches, research successful channels and
                uncover content opportunities with intelligent analytics.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Button asChild size="lg">
                  <Link href={user ? "/niches" : "/register"}>
                    <Compass className="size-4" /> Explore Niches
                  </Link>
                </Button>
                <Button asChild size="lg" variant="secondary">
                  <Link href={user ? "/dashboard" : "/register"}>
                    Get Started <ArrowRight className="size-4" />
                  </Link>
                </Button>
              </div>
              <dl className="mt-8 flex flex-wrap gap-x-8 gap-y-3 text-sm">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted">Niches mapped</dt>
                  <dd className="mt-0.5 text-lg font-semibold tabular-nums">{taxonomyStats.niches}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted">Categories</dt>
                  <dd className="mt-0.5 text-lg font-semibold tabular-nums">{taxonomyStats.categories}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted">Keywords</dt>
                  <dd className="mt-0.5 text-lg font-semibold tabular-nums">{formatNumber(taxonomyStats.keywords)}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted">Data policy</dt>
                  <dd className="mt-0.5 text-lg font-semibold">30-day</dd>
                </div>
              </dl>
            </div>

            <ProductPreview />
          </div>
        </div>
      </section>

      {/* Source strip */}
      <section className="border-b border-border bg-surface/60">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-8 gap-y-3 px-4 py-5 text-xs text-muted sm:px-6">
          <span className="font-medium uppercase tracking-wider text-muted-strong">Built on</span>
          <span className="flex items-center gap-1.5"><PlaySquare className="size-3.5" /> YouTube Data API v3</span>
          <span className="flex items-center gap-1.5"><Database className="size-3.5" /> PostgreSQL + Drizzle</span>
          <span className="flex items-center gap-1.5"><Layers className="size-3.5" /> Next.js Route Handlers</span>
          <span className="flex items-center gap-1.5"><BrainCircuit className="size-3.5" /> Agnes AI</span>
          <span className="flex items-center gap-1.5"><ShieldCheck className="size-3.5" /> Auth.js</span>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Platform</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            Research depth, without the fabricated numbers.
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted sm:text-base">
            NicheScope combines a maintained taxonomy with compliant data integrations,
            a versioned scoring model and AI that is only allowed to reason over
            permitted evidence.
          </p>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="card-hover rounded-xl border border-border bg-card p-5"
            >
              <span className="flex size-9 items-center justify-center rounded-lg bg-primary-soft text-primary">
                <feature.icon className="size-4" />
              </span>
              <h3 className="mt-3 text-sm font-semibold">{feature.title}</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-muted">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="border-y border-border bg-surface/40">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-xl">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Workflow</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight">How it works</h2>
            </div>
            <p className="max-w-md text-sm text-muted">
              From taxonomy to production-ready plan in four steps — with every
              source, estimate and assumption visible along the way.
            </p>
          </div>
          <ol className="mt-10 grid gap-4 md:grid-cols-4">
            {STEPS.map((step, index) => (
              <li key={step.title} className="relative rounded-xl border border-border bg-card p-5">
                <span className="flex size-8 items-center justify-center rounded-lg bg-card-elevated text-xs font-semibold text-muted">
                  0{index + 1}
                </span>
                <step.icon className="absolute right-5 top-5 size-4 text-primary/70" />
                <h3 className="mt-4 text-sm font-semibold">{step.title}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-muted">{step.description}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Analytics preview */}
      <section id="analytics" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-secondary">Analytics</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight">
              Scores you can explain to a client.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              The opportunity model publishes its weights, normalisation ranges and
              inputs. Competition is inverted, so harder niches score lower for
              opportunity. Nothing is a black box — including the rank.
            </p>
            <ul className="mt-6 space-y-3 text-sm">
              {[
                "7, 30 and 90-day measurement windows",
                "Competition inversion with 20% of the weight",
                "Emerging and declining cohorts derived from the same inputs",
                "Scoring version, source and calculation time stored per ranking",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-muted-strong">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" /> {item}
                </li>
              ))}
            </ul>
            <Button asChild variant="secondary" size="sm" className="mt-7">
              <Link href="/trends">
                View global trends <ArrowUpRight className="size-3.5" />
              </Link>
            </Button>
          </div>
          <div className="relative">
            <div className="absolute -inset-3 rounded-2xl bg-gradient-to-br from-primary/10 to-secondary/10 blur-xl" />
            <div className="relative rounded-xl border border-border bg-card p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted">Opportunity model</p>
                  <p className="text-sm font-semibold">Weighted components</p>
                </div>
                <Badge variant="warning" className="gap-1">
                  <FlaskConical className="size-3" /> Illustrative preview
                </Badge>
              </div>
              <div className="mt-5 space-y-3">
                {[
                  { label: "Recent growth", weight: 25, value: 82 },
                  { label: "Channel growth", weight: 20, value: 64 },
                  { label: "Video performance", weight: 20, value: 71 },
                  { label: "Competition opportunity", weight: 20, value: 58 },
                  { label: "Engagement", weight: 10, value: 76 },
                  { label: "Content consistency", weight: 5, value: 69 },
                ].map((row) => (
                  <div key={row.label}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-strong">{row.label}</span>
                      <span className="tabular-nums text-muted">{row.weight}% weight</span>
                    </div>
                    <div className="mt-1 flex h-2 overflow-hidden rounded-full bg-card-elevated">
                      <div
                        className="rounded-full bg-primary/80"
                        style={{ width: `${row.value}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-5 flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2.5">
                <span className="text-xs text-muted">Composite opportunity score</span>
                <span className="font-mono text-lg font-semibold text-primary">71.6</span>
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-muted">
                Illustrative values showing how the published model composes. Actual
                scores require an eligible data source.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Compliance */}
      <section className="border-y border-border bg-surface/40">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-14 sm:px-6 lg:grid-cols-3">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
              <Lock className="size-4" />
            </span>
            <div>
              <h3 className="text-sm font-semibold">Credentials stay server-side</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                API keys are read only in route handlers and services. OAuth tokens are
                encrypted at rest with AES-256-GCM.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
              <Globe2 className="size-4" />
            </span>
            <div>
              <h3 className="text-sm font-semibold">Global without geo-claims</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                Region and language selection drive localized searches. NicheScope
                never claims geographic popularity without contract permission.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
              <Zap className="size-4" />
            </span>
            <div>
              <h3 className="text-sm font-semibold">Quota-aware by default</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                Expensive search calls are cached, deduplicated and blocked once the
                daily budget is exhausted — before the request is sent.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Pricing</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight">Plans that scale with research</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-muted">
            Start free. Upgrade when your research volume does. Billing provider
            integration is prepared but not enabled in this deployment.
          </p>
        </div>
        <div className="mt-10 grid gap-4 lg:grid-cols-3">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`relative flex flex-col rounded-xl border p-6 ${
                plan.highlight
                  ? "border-primary/40 bg-card shadow-glow"
                  : "border-border bg-card"
              }`}
            >
              {plan.highlight && (
                <Badge className="absolute -top-2.5 left-6">Most popular</Badge>
              )}
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">{plan.name}</h3>
              <p className="mt-2 flex items-baseline gap-1">
                <span className="text-3xl font-semibold tracking-tight">{plan.price}</span>
                <span className="text-xs text-muted">/ {plan.cadence}</span>
              </p>
              <p className="mt-2 text-xs text-muted">{plan.description}</p>
              <ul className="mt-5 flex-1 space-y-2 text-sm">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-muted-strong">
                    <Check className="mt-0.5 size-3.5 shrink-0 text-primary" />
                    <span className="text-xs leading-relaxed">{feature}</span>
                  </li>
                ))}
              </ul>
              <Button
                asChild
                className="mt-6"
                variant={plan.highlight ? "default" : "secondary"}
              >
                <Link href={plan.href}>{plan.cta}</Link>
              </Button>
            </div>
          ))}
        </div>
        <p className="mt-4 text-center text-[11px] text-muted">
          AI limits are enforced per account per day. Ranking availability depends on
          your deployment's approved data sources, not on plan tier.
        </p>
      </section>

      {/* FAQ */}
      <section id="faq" className="border-t border-border bg-surface/40">
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
          <h2 className="text-center text-3xl font-semibold tracking-tight">
            Frequently asked questions
          </h2>
          <div className="mt-8 divide-y divide-border rounded-xl border border-border bg-card">
            {FAQS.map((faq) => (
              <details key={faq.q} className="group px-5 py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-medium text-foreground">
                  {faq.q}
                  <span className="text-muted transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-muted">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative overflow-hidden border-t border-border">
        <div className="pointer-events-none absolute inset-0 bg-radial-brand opacity-80" />
        <div className="relative mx-auto flex max-w-4xl flex-col items-center gap-5 px-4 py-16 text-center sm:px-6 sm:py-20">
          <TrendingUp className="size-8 text-primary" />
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Research the next niche before you film it.
          </h2>
          <p className="max-w-xl text-sm text-muted sm:text-base">
            Build a defensible shortlist with a taxonomy-backed explorer, compliant
            YouTube research and an AI advisor that shows its evidence.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/register">Get Started free</Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link href="/niches">Explore Niches</Link>
            </Button>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}

function ProductPreview() {
  return (
    <div className="relative animate-fade-in">
      <div className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-primary/15 via-transparent to-secondary/15 blur-2xl" />
      <div className="relative overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
        <div className="flex items-center gap-1.5 border-b border-border bg-surface px-4 py-2.5">
          <span className="size-2 rounded-full bg-danger/60" />
          <span className="size-2 rounded-full bg-warning/60" />
          <span className="size-2 rounded-full bg-primary/60" />
          <span className="ml-3 rounded bg-card px-2 py-0.5 text-[10px] text-muted">
            nichscope.app/dashboard
          </span>
          <Badge variant="warning" className="ml-auto gap-1">
            <FlaskConical className="size-2.5" /> Preview
          </Badge>
        </div>
        <div className="grid grid-cols-[68px_1fr] sm:grid-cols-[88px_1fr]">
          <div className="border-r border-border bg-surface p-2.5">
            {[Compass, TrendingUp, Tv, Film, Sparkles, Bookmark].map((Icon, index) => (
              <div
                key={index}
                className={`mb-1 flex h-7 items-center gap-2 rounded px-2 ${
                  index === 0 ? "bg-primary-soft text-primary" : "text-muted"
                }`}
              >
                <Icon className="size-3.5" />
                <span className="hidden h-1.5 flex-1 rounded bg-current opacity-20 sm:block" />
              </div>
            ))}
          </div>
          <div className="p-3.5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold">Opportunity rankings</p>
                <p className="text-[9px] text-muted">30-day window · 79 niches</p>
              </div>
              <span className="rounded border border-border px-1.5 py-0.5 text-[9px] text-muted">
                Top 10
              </span>
            </div>
            <div className="mt-3 space-y-2">
              {[
                { name: "AI Agents", category: "Artificial Intelligence", score: 88, growth: "+124%" },
                { name: "AI Automation", category: "Artificial Intelligence", score: 84, growth: "+96%" },
                { name: "Personal Finance", category: "Finance", score: 79, growth: "+38%" },
                { name: "Faceless AI Video", category: "Artificial Intelligence", score: 76, growth: "+67%" },
                { name: "True Crime", category: "Documentary", score: 72, growth: "+21%" },
                { name: "Mobile Gaming", category: "Gaming", score: 43, growth: "−12%" },
              ].map((row, index) => (
                <div
                  key={row.name}
                  className="flex items-center gap-2 rounded-lg border border-border/70 bg-surface/70 px-2.5 py-1.5"
                >
                  <span className="w-3 text-[9px] font-semibold tabular-nums text-muted">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[10px] font-medium">{row.name}</p>
                    <p className="truncate text-[8px] text-muted">{row.category}</p>
                  </div>
                  <div className="hidden w-16 sm:block">
                    <div className="h-1 rounded-full bg-card-elevated">
                      <div
                        className="h-1 rounded-full bg-primary"
                        style={{ width: `${row.score}%` }}
                      />
                    </div>
                  </div>
                  <span className="w-6 text-right text-[9px] font-semibold tabular-nums text-primary">
                    {row.score}
                  </span>
                  <span
                    className={`w-10 text-right text-[9px] tabular-nums ${
                      row.growth.startsWith("−") ? "text-danger" : "text-primary"
                    }`}
                  >
                    {row.growth}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {[
                { label: "Emerging", value: "12" },
                { label: "Low comp.", value: "27" },
                { label: "Sources", value: "2" },
              ].map((stat) => (
                <div key={stat.label} className="rounded-lg border border-border/70 bg-surface/70 p-2">
                  <p className="text-[8px] uppercase tracking-wide text-muted">{stat.label}</p>
                  <p className="text-xs font-semibold tabular-nums">{stat.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="border-t border-border bg-surface px-4 py-1.5 text-center text-[9px] text-muted">
          Illustrative interface preview. Demo fixtures, not live YouTube statistics.
        </div>
      </div>
    </div>
  );
}
