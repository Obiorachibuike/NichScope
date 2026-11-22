# NicheScope

**Discover Winning YouTube Niches. Find Your Next Opportunity.**

NicheScope is a full-stack YouTube niche research SaaS: a hierarchical, admin-managed
taxonomy, evidence-attributed niche analytics, a transparent ranking engine, channel and
video research, AI research reports, watchlists, and an operations dashboard with
data-governance controls.

It is a real application — Next.js App Router, PostgreSQL/Drizzle, Auth.js, a dedicated
pg-boss worker, API route handlers, and server-side AI providers — not a static mockup.

> **Data honesty is a product requirement.** NicheScope never invents growth,
> competition, engagement or opportunity numbers. Every metric row carries its source,
> confidence and calculation time. Demo data is explicitly labelled. YouTube-derived
> aggregation stays disabled until written approval is recorded *and* the deployment
> flag permits it.

---

## Contents

- [Feature overview](#feature-overview)
- [Architecture](#architecture)
- [Ranking model](#ranking-model)
- [Compliance model](#compliance-model)
- [Data sources](#data-sources)
- [AI providers](#ai-providers)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Database](#database)
- [API](#api)
- [Background jobs](#background-jobs)
- [Security](#security)
- [Testing](#testing)
- [Build results](#build-results)
- [Deployment](#deployment)
- [Outstanding approvals and credentials](#outstanding-approvals-and-credentials)
- [Project layout](#project-layout)

---

## Feature overview

### Marketing & auth
- Landing page with product preview (explicitly labelled demo fixture), ranking-model
  explainer, pricing, FAQ and compliance strip.
- Register / login with email + password (bcrypt), optional Google OAuth, and one-click
  demo-account prefills for local evaluation.
- Route protection at the edge (`src/proxy.ts`) plus server-side session verification in
  every protected page and API handler.

### Niche Explorer
- 16 categories, hierarchical niches (top-level and sub-niches), aliases and keyword maps.
- Debounced search with taxonomy suggestions, recent-search history (command palette and
  `/search`), alias/keyword matching.
- Filters: category, format (Shorts / long-form), competition, growth trend, country,
  language, monetization potential, minimum opportunity score, minimum average views,
  ranking window (7d/30d/90d) and a custom date range.
- Multi-filter, URL-persisted state, sorting, pagination, clear-all and save-search.
- Bookmarks/watchers for niches, with private notes, tags, folders, duplicate prevention
  and ownership enforcement.

### Niche details
- Opportunity score dial with source-attributed components.
- Growth/opportunity chart across windows and a score-component radar.
- Ranking positions per category with the stored score explanation and scoring version.
- Data-provenance table (window, source, confidence, calculation time).
- Tabs for individual videos, channels, sub-niches, keyword map and AI analysis.
- Explicit empty states when no eligible source exists — never fabricated stats.

### Research surfaces
- **Sub-niche Explorer** — second-level taxonomy with parent attribution.
- **Channel Intelligence** — individual public channel records with retrieval timestamps,
  30-day refresh window and YouTube links.
- **Video Research** — format/language/region/publication filters; format is estimated
  from duration because the Data API exposes no Shorts flag.
- **Global Trends** — six cohorts (opportunity, top performing, highest growth, low
  competition, emerging, declining) built only from eligible sources.
- **AI Niche Advisor** — evidence-grounded reports, report library, usage limits, and a
  visible split between verified evidence, estimates and recommendations.

### Workspace
- Dashboard: rankings, emerging cohorts, watchlist snapshot, recent AI reports, alerts,
  source freshness, quota and compliance state.
- Saved Niches: watchlist management, notes/folders, saved searches, eligible alerts.
- Settings: profile/preferences, security notes, AI usage, account deletion.
- Billing: plan entitlements and AI allowance; payment provider intentionally not faked.

### Admin
- Users (role/plan/status), taxonomy management (categories, niches, activation,
  featured), data sources and per-scope permissions with approval references and
  expiration, effective-use matrix, API quota and recent requests, jobs (queued, running,
  failed, dead-letter, manual enqueue), AI provider usage/status, compliance audit trail,
  full audit log, and platform health.

---

## Architecture

```
Browser
  │  React 19 / Next.js App Router (server components + client islands)
  ▼
Next.js app (Vercel or Node)                    Dedicated worker (Node 22)
  ├─ src/proxy.ts (Auth.js edge gate)            ├─ pg-boss schedule (every minute)
  ├─ Pages: (app), (auth), marketing             ├─ shared job ledger + claim loop
  ├─ Route handlers /api/v1/*                    ├─ YouTube sync / rankings / retention
  │    ├─ Zod validation, authz, rate limits     ├─ AI report jobs / watchlist monitor
  │    ├─ Services (modular, DB-aware)           └─ HTTP health endpoint :3001/health
  │    │    ├─ ranking engine
  │    │    ├─ compliance / governance
  │    │    ├─ YouTube client + quota
  │    │    └─ AI provider abstraction
  │    └─ Drizzle ORM ───────────────┐
  └─ Auth.js (JWT sessions)          ▼
                                PostgreSQL
                       (managed; PGlite only as a local
                        development fallback)
```

No Redis/Celery/RabbitMQ/Python services are used. The only background infrastructure is
the managed PostgreSQL instance (shared by the app and pg-boss), which keeps operations
simple and avoids extra stateful dependencies.

## Ranking model

Scoring version: `opportunity-v1` (stored with every generated row).

| Component | Weight | Normalisation |
|---|---:|---|
| Recent view growth | 25 | −50%…150% → 0…100 |
| Channel growth | 20 | −20%…80% → 0…100 |
| Video performance | 20 | 0…100 input |
| Competition opportunity | 20 | `100 − competitionScore` (higher competition lowers the score) |
| Engagement | 10 | 0%…12% → 0…100 |
| Content consistency | 5 | 0…100 input |

Weights total 100 and are validated in tests. Every ranking row stores the source, scoring
version, calculation timestamp, measurement period, sample counts, input provenance and a
human-readable explanation.

Cohort formulas:

| Category | Formula / eligibility |
|---|---|
| Opportunity | weighted score |
| Top performing | 0.5 × opportunity + 0.5 × performance |
| Highest growth | growth |
| Low competition | 0.7 × (100 − competition) + 0.3 × opportunity; competition < 55 |
| Emerging | 0.6 × growth + 0.4 × opportunity; growth ≥ 40 and competition ≤ 60 |
| Declining | growth; growth < −2 |

Windows: 7-day, 30-day and 90-day. Custom date ranges filter the explorer by taxonomy
refresh window; ranking cohorts are generated for the three fixed measurement windows.

## Compliance model

- **YouTube API data** is fetched server-side only through documented `search.list`,
  `videos.list`, `channels.list`, `playlistItems.list`, `videoCategories.list` and
  `i18nRegions.list` endpoints. No scraping, browser automation, undocumented endpoints or
  content download.
- Public YouTube records are retained for **at most 30 days** (`YOUTUBE_DATA_RETENTION_DAYS`
  is clamped) and refreshed on schedule. The retention job deletes expired rows and
  snapshots.
- **Individual research and public display with attribution** are allowed for individual
  channel/video records.
- **Cross-channel aggregation, derived metrics, opportunity scoring, ranking, historical
  tracking and commercial display** are denied by default for YouTube data. They require:
  1. `YOUTUBE_ANALYTICS_APPROVAL_STATUS=approved`, **and**
  2. an approved permission row for the exact scope with an approval/contract reference.
- Licensed provider datasets are separately identified, gated by
  `LICENSED_DATA_PROVIDER_ENABLED=true` plus per-scope contract approvals, and never mixed
  into YouTube-derived cohorts.
- Demo fixtures are only served when `DEMO_MODE=true` and are labelled in UI and API
  responses.
- Admin toggles cannot override provider terms; the server-side evaluation matrix decides
  what the app may compute. The app remains useful without permissions: taxonomy,
  discovery, keyword search, individual channel/video research, watchlists and AI on
  permitted evidence.

## Data sources

| Key | Type | Purpose | Default state |
|---|---|---|---|
| `internal_taxonomy` | internal | Categories, niches, keywords, aliases | Active, no stats |
| `youtube_data_api` | youtube_api | Individual public channel/video metadata | Active for individual research; aggregation denied |
| `licensed_analytics` | licensed_analytics | Contracted performance data | Disabled pending contract |
| `demo_fixture` | demo_fixture | Labelled development dataset | Only with `DEMO_MODE=true` |
| `ai_provider` | ai | Report metadata | Metadata only, not statistics |

## AI providers

`AIProvider` abstraction with one method per report type: `analyzeNiche`,
`generateSubNiches`, `generateVideoIdeas`, `analyzeCompetition`, `generateChannelStrategy`,
`generateResearchReport`.

- Primary: Agnes (`AGNES_API_KEY`, OpenAI-compatible API).
- Fallback: OpenAI (`OPENAI_API_KEY`), used automatically when the primary fails.
- Demo/offline: a deterministic fixture generator for environments without AI credentials.
  It is clearly labelled and never invents statistics.
- Every prompt receives structured permitted evidence only (taxonomy facts, keywords,
  metrics with source/confidence labels). Responses are schema-validated with Zod, retried
  on transient failures, persisted with token/cost metadata, and subject to per-plan daily
  limits and a platform cost cap.

---

## Getting started

Requirements: **Node.js ≥ 22.12**, npm 10+. A local PostgreSQL is optional for the web app
(the embedded PGlite engine is used when `DATABASE_URL` is absent), but the dedicated
pg-boss worker requires a real PostgreSQL instance.

```bash
npm install
cp .env.example .env.local        # set AUTH_SECRET at minimum
npm run db:migrate                 # creates schema (PGlite or PostgreSQL)
npm run db:seed                    # taxonomy + demo accounts + labelled fixtures
npm run dev                        # http://localhost:3000
```

Demo accounts (only created by the seed script):

| Role | Email | Password |
|---|---|---|
| User | `demo@nichscope.app` | `NicheScope123!` |
| Admin | `admin@nichscope.app` | `NicheScope123!` |

Demo metrics/rankings come from clearly labelled fixtures. Set `DEMO_MODE=false` and
connect an eligible source to see genuine, source-attributed analytics.

Production:

```bash
npm run build
npm run start
npm run worker                     # separate process, real DATABASE_URL required
```

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `NODE_ENV` | yes | `development` / `test` / `production` |
| `NEXT_PUBLIC_APP_URL` | yes | Public origin used in metadata and links |
| `AUTH_SECRET` | yes | Auth.js JWT signing secret (32+ random bytes) |
| `DATABASE_URL` | production | Managed PostgreSQL connection string |
| `DIRECT_DATABASE_URL` | production | Direct (non-pooled) connection for migrations |
| `YOUTUBE_API_KEY` | for live YouTube | Enables documented Data API v3 lookups |
| `AGNES_API_KEY` | for primary AI | Agnes provider key |
| `OPENAI_API_KEY` | for fallback AI | OpenAI fallback key |
| `AI_PROVIDER` | yes | `agnes` (default), `openai`, or `fixture` |
| `WORKER_ENABLED` | yes | Enables the worker process |
| `WORKER_CONCURRENCY` | yes | Worker parallelism (default `3`) |
| `YOUTUBE_ANALYTICS_APPROVAL_STATUS` | yes | `not_approved` by default; set `approved` only with written approval |
| `LICENSED_DATA_PROVIDER_ENABLED` | yes | `false` until a contract exists |
| `SENTRY_DSN` | recommended | Enables Sentry error reporting |

Optional: `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`, `YOUTUBE_DAILY_QUOTA`,
`YOUTUBE_DATA_RETENTION_DAYS` (max 30), `AGNES_*`/`OPENAI_*` base URLs and models,
`WORKER_EMBEDDED` (development-only in-process runner), `WORKER_PORT`, `DEMO_MODE`,
rate-limit and AI-limit tuning. See [`.env.example`](.env.example).

## Database

- PostgreSQL with Drizzle ORM. Migration SQL is generated into [`drizzle/`](drizzle) and
  applied with `npm run db:migrate` (uses `DIRECT_DATABASE_URL` when present).
- Core tables: `users`, `accounts`, `sessions`, `verification_tokens`, `subscriptions`,
  `categories`, `niches`, `niche_keywords`, `niche_metrics`, `niche_rankings`,
  `ranking_versions`, `data_sources`, `data_permissions`, `api_usage`, `api_snapshots`,
  `channel_authorizations`, `youtube_channels`, `youtube_videos`, `niche_watchlists`,
  `watchlist_alerts`, `saved_searches`, `ai_reports`, `background_jobs`, `audit_logs`.
- PGlite is used only when `DATABASE_URL` is unset (local development). It is not a
  production database and is not used by the pg-boss worker.

## API

Base path `/api/v1`. All handlers validate input with Zod, enforce authentication and
ownership, apply rate limits and return consistent `{ data, meta }` or
`{ error: { message, code, details? } }` envelopes.

| Method | Endpoint | Notes |
|---|---|---|
| GET | `/dashboard` | Aggregated rankings, stats, alerts, freshness, quota |
| GET | `/categories` | Active taxonomy categories |
| GET | `/niches` | Filtered, sorted, paginated explorer query |
| GET | `/niches/:slug` | Detail with metrics, rankings, related, provenance |
| GET | `/niches/:slug/metrics` | Metrics history |
| GET | `/niches/:slug/channels` | Individual channel records (`?live=1` optional) |
| GET | `/niches/:slug/videos` | Individual video records (`?live=1` optional) |
| GET | `/search`, `/search/suggest`, `/search/history` | Full search, suggestions, recent searches |
| GET | `/trending` | Global cohorts with eligibility notes |
| GET | `/channels/search`, `/videos/search` | Individual-record research |
| POST | `/youtube/search` | Explicit live lookup (503 when unconfigured) |
| GET | `/youtube/status` | Configuration, quota, retention cutoff |
| GET/POST | `/watchlist` | List / add (duplicate → 409) |
| PATCH/DELETE | `/watchlist/:id` | Notes/folder update / remove (ownership checked) |
| GET/POST/DELETE | `/saved-searches` | Saved explorer queries |
| POST | `/ai/analyze` | Generate + persist a report |
| GET | `/ai/reports`, `/ai/reports/:id` | Report library / single report |
| GET/PATCH | `/settings` | Profile and preferences |
| DELETE | `/account` | Deletes personal data and sessions |
| GET | `/health` | Public liveness + database status |
| GET | `/admin/users`, `PATCH /admin/users/:id` | User administration |
| GET/POST | `/admin/categories`, `PATCH /admin/categories/:id` | Taxonomy administration |
| GET/POST | `/admin/niches`, `PATCH /admin/niches/:id` | Hierarchical niche administration |
| GET/PATCH | `/admin/data-sources`, `/admin/data-sources/:id` | Sources and permissions |
| GET | `/admin/api-usage`, `/admin/jobs`, `/admin/compliance`, `/admin/health`, `/admin/audit`, `/admin/ai` | Operations |
| POST | `/admin/jobs` | Enqueue a job (idempotent) |

Auth.js endpoints live under `/api/auth/*`; registration is `/api/auth/register`
(5 attempts / 5 minutes / IP).

Status codes used: 200, 201, 202 (job accepted), 400 validation, 401 unauthenticated,
403 forbidden, 404 not found, 409 conflict/duplicate, 429 rate limited, 503 integration
not configured, 500 internal.

## Background jobs

Shared job ledger (`background_jobs`) + pg-boss schedule in the dedicated worker; an
embedded runner exists for local development only.

`youtube.discovery`, `youtube.video-metadata`, `youtube.channel-metadata`, `data.retention`,
`data.refresh`, `licensed.ingest`, `rankings.generate`, `ai.report.generate`,
`watchlist.monitor`, `quota.monitor`, `snapshots.cleanup`, `worker.heartbeat`.

Properties: unique idempotency keys, atomic claim (`for update skip locked`), exponential
backoff capped at 300s, attempt tracking, dead-letter status, per-job timeouts, concurrency
limits, graceful SIGTERM shutdown and a `/health` endpoint on the worker (`WORKER_PORT`,
default 3001).

## Security

- bcrypt password hashing; Auth.js JWT sessions in http-only, secure, same-site cookies.
- OAuth provider tokens encrypted at rest with AES-256-GCM.
- Zod validation on every route handler and server action boundary; parameterised SQL via
  Drizzle (no string-interpolated user input).
- Server-side authorization for ownership (watchlists, reports, searches) and admin roles.
- Rate limiting per route class (registration, AI, search, live YouTube, watchlist).
- Security headers: CSP, nosniff, referrer policy, permissions policy, HSTS; no
  `X-Powered-By`.
- Audit logging for sign-ins, admin changes, permission changes, AI generation and account
  deletion; account deletion removes personal data and sessions.
- Secrets are read server-side only; no API keys are exposed to the browser bundle.

## Testing

```bash
npm run lint          # ESLint 9 flat config
npm run typecheck     # tsc --noEmit
npm test              # Vitest (unit + component)
npm run test:e2e      # Playwright (api + chromium projects)
npm run build         # production build
npm run verify        # lint + typecheck + unit + build
```

Coverage includes: ranking weights/normalisation/competition inversion/category
thresholds/explanation; compliance denial by default, approval gating, expiration and
licensing gates; AI JSON extraction, cost estimation and report schemas; filter coercion
and hostile input handling; formatters; accessible score primitives; API end-to-end flows
(auth, RBAC, pagination, provenance, watchlist duplicates, AI persistence, compliance
matrix).

### Actual results (this workspace, 2026-11-22)

| Check | Result |
|---|---|
| `npm run lint` | ✅ 0 errors, 0 warnings |
| `npm run typecheck` | ✅ 0 errors |
| `npm test` | ✅ 6 files, **56 tests passed** |
| `npx playwright test --project=api` | ✅ **9 tests passed** (health, auth, RBAC, niche search/detail, watchlist, AI, admin) |
| `npx playwright test --project=chromium` | ⚠️ Not run here — the sandbox cannot download browser binaries (only GitHub/npm/PyPI egress). Specs are ready; run them in CI or locally after `npx playwright install chromium`. |
| `npm run build` | ✅ Compiled successfully; all 50+ routes generated (dynamic SSR + proxy) |
| Manual smoke tests | ✅ Landing/login/register; dashboard; explorer; niche detail; sub-niches; channels; videos; trends; advisor; saved; settings; billing; all admin tabs; watchlist add/duplicate; AI fixture report; account deletion; 503 for unconfigured YouTube |

The worker process requires a real PostgreSQL instance; its TypeScript build is verified via
`npm run worker:build`, but pg-boss cannot start against the embedded PGlite engine.

## Build results

```
✓ Compiled successfully
✓ Generating static pages (26/26)
Route (app) — 50+ dynamic routes + ƒ Proxy (Middleware)
```

`npm run build` was run against Node 22.22.3 with no type or lint errors. The only build
warning observed initially (dynamic filesystem tracing for PGlite) is explicitly scoped
with a `turbopackIgnore` annotation.

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for Vercel + managed PostgreSQL + separate worker
instructions, health checks, migrations, monitoring, backups and rollback.

Short version:

1. Provision managed PostgreSQL (Neon/Supabase/RDS). Set `DATABASE_URL` and
   `DIRECT_DATABASE_URL`.
2. Run `npm run db:migrate` from CI or a one-off job using the direct URL.
3. Deploy the Next.js app (Vercel) with all environment variables. Do **not** enable
   `WORKER_EMBEDDED` in production.
4. Deploy `npm run worker` as a long-lived process (Render/Fly/Railway/ECS) with
   `WORKER_ENABLED=true` and the same database/API secrets. Health check `/health` on
   `WORKER_PORT`.
5. Configure Sentry, uptime checks on `/api/v1/health` and the worker health endpoint.

## Outstanding approvals and credentials

This repository is complete at the code level, but the following are intentionally **not**
enabled without external inputs:

| Item | Status | Action required |
|---|---|---|
| YouTube analytics aggregation approval | `not_approved` | Obtain written approval, set `YOUTUBE_ANALYTICS_APPROVAL_STATUS=approved`, then record the scope + reference in Admin → Data sources |
| Licensed analytics provider | disabled | Contract + `LICENSED_DATA_PROVIDER_ENABLED=true`, per-scope approval references |
| `YOUTUBE_API_KEY` | not set | Google Cloud project with YouTube Data API v3 enabled |
| `AGNES_API_KEY` / `OPENAI_API_KEY` | not set | Provider accounts; otherwise reports use the labelled offline generator |
| Google OAuth | not configured | Create OAuth client, set client ID/secret and redirect URI |
| Payment provider | not configured | Billing UI is informational; plans can be assigned manually by an admin |
| Sentry DSN | not set | Create project and set `SENTRY_DSN` |

No fabricated statistics are used to fill these gaps. Features degrade to explicit empty
states, individual-record research, taxonomy discovery and clearly labelled fixtures.

## Project layout

```
src/
  app/
    (auth)/login, register          Auth pages
    (app)/                          Authenticated shell: dashboard, niches, subniches,
                                    channels, videos, trends, advisor, saved, settings,
                                    billing, admin, search
    api/auth/*                      Auth.js + registration
    api/v1/*                        Versioned REST surface
    page.tsx                        Landing page
  components/                        Design system, charts, media cards, filters,
                                    report renderer, admin controls
  lib/
    services/                        Domain services (niches, ranking, compliance,
                                    research, dashboard, ai, youtube, admin)
    db/                              Drizzle schema, client, taxonomy seed, fixtures
    jobs/                            Job catalog, handlers, queue, embedded runner
    auth/                            Auth.js configuration and session helpers
  worker/index.ts                    Dedicated worker + health endpoint
  proxy.ts                           Edge auth gate
drizzle/                             Generated SQL migrations
scripts/                             migrate / seed entry points
tests/                               Vitest setup + Playwright API/UI specs
```

---

NicheScope is an independent product and is not endorsed by YouTube or Google. YouTube is
a trademark of Google LLC.
