# NicheScope — Deployment Guide

This guide covers the production topology: **Next.js web app + managed PostgreSQL + a
separate pg-boss worker**. The app degrades safely without YouTube/AI credentials, but a
production deployment needs a real PostgreSQL database and `AUTH_SECRET`.

## 1. Topology

| Component | Recommended host | Notes |
|---|---|---|
| Next.js app | Vercel (or any Node host) | Route handlers + server components; no embedded worker |
| PostgreSQL | Neon, Supabase, RDS, Cloud SQL | pg-boss needs a direct/persistent connection (session mode if pooled) |
| Worker | Render, Fly.io, Railway, ECS, Kubernetes | Long-lived Node 22 process, `npm run worker` |
| Monitoring | Sentry + uptime checks | `/api/v1/health` and worker `/health` |
| Object storage | Not required | No video/content downloads |

Do **not** set `WORKER_EMBEDDED=true` in production. It exists for local development only.

## 2. Provision PostgreSQL

1. Create a database and role with `CREATE`, `ALTER`, `INSERT`, `UPDATE`, `DELETE`.
2. Copy two connection strings:
   - `DATABASE_URL` — pooled/runtime connection (SSL required).
   - `DIRECT_DATABASE_URL` — direct connection used for migrations.
3. Enable automated backups and point-in-time recovery (Neon/Supabase/RDS support this).
   Target RPO ≤ 24h, retention ≥ 7 days; 30 days for paid plans.

pg-boss creates its own schema objects on first start. If you use PgBouncer, use session
pooling for the worker or connect directly; transaction pooling can break `LISTEN/NOTIFY`
and advisory locks.

## 3. Apply migrations

From CI or a one-off task with `DIRECT_DATABASE_URL` set:

```bash
npm ci
npm run db:migrate
```

Optionally seed only the taxonomy (never demo accounts) by adapting
`scripts/seed.ts`; the default seed inserts demo users and labelled fixtures and should
not be run against production.

## 4. Deploy the web app (Vercel)

1. Import the repository; framework preset **Next.js**, build `npm run build`, start is
   managed by Vercel.
2. Set environment variables for Production (and Preview if desired):

```
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://app.yourdomain.com
AUTH_SECRET=<openssl rand -base64 32>
DATABASE_URL=postgresql://.../nichscope?sslmode=require
DIRECT_DATABASE_URL=postgresql://.../nichscope?sslmode=require
YOUTUBE_API_KEY=
AGNES_API_KEY=
OPENAI_API_KEY=
AI_PROVIDER=agnes
WORKER_ENABLED=true
WORKER_CONCURRENCY=3
WORKER_EMBEDDED=false
YOUTUBE_ANALYTICS_APPROVAL_STATUS=not_approved
LICENSED_DATA_PROVIDER_ENABLED=false
SENTRY_DSN=
DEMO_MODE=false
```

3. Add the Google OAuth redirect URI if you enable Google sign-in:
   `https://app.yourdomain.com/api/auth/callback/google`.
4. Deploy. `src/proxy.ts` protects application routes at the edge; every page and API
   handler re-verifies the session server-side.

### Vercel notes

- Do not rely on Vercel cron for the worker; deploy it as a separate service.
- Set the Node.js runtime to 22.x (pg-boss and Next 16 require modern Node).
- Use the pooled `DATABASE_URL` for runtime and `DIRECT_DATABASE_URL` only in CI/migration
  jobs.
- If you front the app with a custom domain, keep `NEXT_PUBLIC_APP_URL` and
  `AUTH_TRUST_HOST=true` consistent to avoid callback URL mismatches.

## 5. Deploy the worker

Create a separate service with:

```
Build:  npm ci && npm run worker:build     # optional compile check
Start:  npm run worker
Health: GET /health on WORKER_PORT (default 3001)
```

Environment: same `DATABASE_URL`, `AUTH_SECRET`, YouTube/AI keys, `WORKER_ENABLED=true`,
`WORKER_CONCURRENCY=3`, `SENTRY_DSN`. The worker:

- applies migrations and runs the idempotent taxonomy seed on start;
- starts pg-boss with the `worker.tick` schedule (every minute);
- claims due jobs from `background_jobs` with `for update skip locked`;
- retries with exponential backoff, moves exhausted jobs to `dead_letter`;
- exposes `/health` with DB latency, last heartbeat and job stats;
- shuts down gracefully on `SIGTERM`/`SIGINT`.

Scale horizontally by running multiple worker replicas; the claim query prevents duplicate
execution. Keep concurrency × replicas within your PostgreSQL connection budget.

## 6. Health checks and monitoring

| Check | Endpoint | Expected |
|---|---|---|
| Web liveness | `GET /api/v1/health` | 200, `status: ok` or `degraded`, `database: true` |
| Admin health | `GET /api/v1/admin/health` | 200 (admin session) |
| Worker | `GET http://worker:3001/health` | 200, recent heartbeat, low failed count |

Recommended alerts:

- web health non-200 for 2 minutes;
- worker heartbeat older than 5 minutes;
- `background_jobs.status = 'dead_letter'` count > 0;
- YouTube quota usage above 85%;
- AI provider failure rate above 20% in 24h;
- database connections above 80% of limit;
- expired YouTube rows awaiting purge older than 48h (Admin → Compliance).

Sentry is initialised from `SENTRY_DSN`; errors in route handlers are tagged with route and
user id (no secrets).

## 7. Data-source approvals (operational procedure)

1. Obtain written approval from the data provider for the exact use (e.g. ranking,
   derived metrics, commercial display).
2. Set the deployment flag:
   - YouTube: `YOUTUBE_ANALYTICS_APPROVAL_STATUS=approved`
   - Licensed data: `LICENSED_DATA_PROVIDER_ENABLED=true` plus contract details
3. Admin → Data sources → approve each scope and paste the approval/contract reference.
4. Redeploy/restart so the flag is read.
5. Verify Admin → Compliance shows the scope as `allowed` and that ranking cohorts populate.
6. Record the approval in your compliance register; permissions carry an optional expiry,
   after which they are treated as denied automatically.

Revoking: set the permission to `denied` (immediate), then optionally reset the deployment
flag. Existing derived rankings referencing that source should be regenerated/purged:
`data.retention` and `rankings.generate` jobs, plus Admin → Compliance to confirm.

## 8. Retention

- Public YouTube rows and snapshots expire per `YOUTUBE_DATA_RETENTION_DAYS`, clamped to 30.
- `data.retention` runs hourly, deletes expired snapshots and refreshes stale records.
- Monitor the “rows awaiting retention purge” metric; a growing backlog means the worker is
  unhealthy.
- Demo fixtures are excluded from production because `DEMO_MODE=false`.

## 9. Backups and restore

1. Enable provider PITR. Take a manual snapshot before migrations.
2. Test restore quarterly into a staging database and run `npm run db:migrate` followed by
   a read-only smoke test (`/api/v1/health`, `/api/v1/niches`).
3. Back up environment secrets in your secret manager (not in the repository).
4. `audit_logs`, `api_usage` and `ai_reports` can be archived separately if retention rules
   require it, but do not remove compliance audit evidence.

## 10. Rollback

**Application**: redeploy the previous Vercel deployment (or previous container image).
Migrations are additive; code rollback without schema rollback is safe for the current
release.

**Worker**: stop the old deployment, deploy the previous image, keep the same database.
Jobs are durable; no job is lost during a graceful shutdown.

**Database**: use provider PITR to a timestamp before the faulty migration, then redeploy
the matching app/worker versions. Regenerate rankings if metric data was affected.

**Compliance incident**: immediately deny the affected scope(s), disable the relevant data
source, purge derived rankings (`rankings.generate` after denial will publish empty
cohorts), and rotate any exposed API key.

## 11. Scaling

- Web: stateless; scale horizontally. Rate limiting is per-instance in-memory — put a
  gateway/WAF rate limit in front for strict global limits.
- Worker: increase `WORKER_CONCURRENCY` or replicas; keep YouTube concurrency modest to
  protect quota and avoid burst limits.
- Database: index growth is dominated by `niche_metrics`, `niche_rankings`, `api_usage` and
  `audit_logs`; add retention/archival policies for `api_usage` beyond 90 days if needed.
- AI: enforce daily limits and the platform cost cap (`AI_DAILY_COST_CAP_USD`); monitor cost
  in Admin → AI providers.

## 12. Pre-flight checklist

- [ ] `AUTH_SECRET` set to a unique 32+ byte value
- [ ] `DATABASE_URL`/`DIRECT_DATABASE_URL` use SSL and a least-privilege role
- [ ] Migrations applied; taxonomy seeded
- [ ] Worker healthy with recent heartbeat
- [ ] `DEMO_MODE=false`, no demo fixtures in production
- [ ] `YOUTUBE_ANALYTICS_APPROVAL_STATUS` and licensed flags reflect actual approvals
- [ ] Sentry DSN set and a test error received
- [ ] Uptime checks on web and worker health
- [ ] Backups/PITR enabled and restore tested
- [ ] Legal pages / privacy policy published for your jurisdiction (not included)
- [ ] Custom domain cookies use `__Secure-` prefix (automatic with HTTPS)

## 13. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `MissingSecret` from Auth.js | `AUTH_SECRET` missing at runtime | Set it in the hosting environment and redeploy |
| Health `database: false` | Bad `DATABASE_URL`, SSL or firewall | Verify connection string and allow egress from the host |
| Worker exits on start | pg-boss cannot reach PostgreSQL | Use a direct/session-pooled connection; check credentials |
| No rankings | No eligible source or approval | Admin → Compliance; approve scopes or expect an explicit empty state |
| Live YouTube returns 503 | `YOUTUBE_API_KEY` missing | Add the key and restart |
| AI report uses the fixture generator | No provider key configured | Set `AGNES_API_KEY` or `OPENAI_API_KEY` |
| Preview iframe blocked | CSP `frame-ancestors` | Add your preview origin to the CSP in `next.config.ts` |
