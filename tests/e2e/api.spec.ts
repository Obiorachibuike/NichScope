import { expect, test, type APIRequestContext } from "@playwright/test";

const DEMO = { email: "demo@nichscope.app", password: "NicheScope123!" };
const ADMIN = { email: "admin@nichscope.app", password: "NicheScope123!" };

async function signIn(request: APIRequestContext, account: { email: string; password: string }) {
  const csrfResponse = await request.get("/api/auth/csrf");
  expect(csrfResponse.ok()).toBeTruthy();
  const { csrfToken } = (await csrfResponse.json()) as { csrfToken: string };

  const callback = await request.post("/api/auth/callback/credentials", {
    form: {
      csrfToken,
      email: account.email,
      password: account.password,
      callbackUrl: "/dashboard",
    },
    maxRedirects: 0,
  });
  expect([200, 302]).toContain(callback.status());

  const session = await request.get("/api/auth/session");
  const body = (await session.json()) as { user?: { email?: string } } | null;
  expect(body?.user?.email).toBe(account.email);
}

test.describe("public surface", () => {
  test("health endpoint reports database state without authentication", async ({ request }) => {
    const response = await request.get("/api/v1/health");
    expect(response.status()).toBe(200);
    const body = (await response.json()) as {
      status: string;
      database: boolean;
      latencyMs: number;
      databaseEngine: string;
      demoMode: boolean;
      timestamp: string;
    };
    expect(["ok", "degraded"]).toContain(body.status);
    expect(typeof body.database).toBe("boolean");
    expect(body.databaseEngine).toBeTruthy();
    expect(Number.isFinite(body.latencyMs)).toBe(true);
    expect(typeof body.demoMode).toBe("boolean");
  });

  test("protected APIs reject anonymous callers", async ({ request }) => {
    for (const path of [
      "/api/v1/dashboard",
      "/api/v1/watchlist",
      "/api/v1/ai/reports",
      "/api/v1/admin/users",
    ]) {
      const response = await request.get(path);
      expect(response.status(), path).toBe(401);
      const body = (await response.json()) as { error?: { code?: string } };
      expect(body.error?.code).toBe("unauthorized");
    }
  });

  test("YouTube live lookups fail safely when no API key is configured", async ({ request }) => {
    await signIn(request, DEMO);
    const response = await request.post("/api/v1/youtube/search", {
      data: { query: "ai agents", type: "video" },
    });
    expect(response.status()).toBe(503);
    const body = (await response.json()) as { error?: { code?: string } };
    expect(body.error?.code).toBe("youtube_not_configured");
  });
});

test.describe("authenticated research", () => {
  test("credentials sign-in grants a session and the dashboard payload is source-attributed", async ({
    request,
  }) => {
    await signIn(request, DEMO);

    const dashboard = await request.get("/api/v1/dashboard");
    expect(dashboard.status()).toBe(200);
    const body = (await dashboard.json()) as {
      data: {
        stats: { niches: number; categories: number };
        rankings: { sourceName: string; isFixture: boolean; score: number }[];
        demoData: boolean;
      };
      meta: { noEligibleRankings: boolean };
    };
    expect(body.data.stats.niches).toBeGreaterThan(0);
    expect(body.data.stats.categories).toBeGreaterThan(0);
    expect(typeof body.data.demoData).toBe("boolean");
    if (body.data.rankings.length > 0) {
      const first = body.data.rankings[0];
      // Rankings always name their source and never carry an unexplained score.
      expect(first.sourceName).toBeTruthy();
      expect(first.score).toBeGreaterThanOrEqual(0);
      expect(first.score).toBeLessThanOrEqual(100);
    } else {
      expect(body.meta.noEligibleRankings).toBe(true);
    }
  });

  test("niche search persists filters and returns taxonomy records", async ({ request }) => {
    await signIn(request, DEMO);
    const response = await request.get(
      "/api/v1/niches?q=ai&format=all&competition=all&growth=all&sort=opportunity&pageSize=6",
    );
    expect(response.status()).toBe(200);
    const body = (await response.json()) as {
      data: { slug: string; name: string; categoryName: string }[];
      meta: { total: number; page: number; pageCount: number; demoData: boolean };
    };
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeLessThanOrEqual(6);
    expect(body.meta.total).toBeGreaterThan(0);
    expect(body.meta.page).toBe(1);
    for (const niche of body.data) {
      expect(niche.slug).toMatch(/^[a-z0-9-]+$/);
      expect(niche.categoryName).toBeTruthy();
    }
  });

  test("niche detail exposes metrics, provenance and rankings", async ({ request }) => {
    await signIn(request, DEMO);
    const list = await request.get("/api/v1/niches?pageSize=6");
    const { data } = (await list.json()) as { data: { slug: string }[] };
    const slug = data[0]?.slug;
    expect(slug).toBeTruthy();

    const detail = await request.get(`/api/v1/niches/${slug}`);
    expect(detail.status()).toBe(200);
    const body = (await detail.json()) as {
      data: {
        niche: { slug: string };
        metrics: { sourceName: string; confidence: string; period: string }[];
        rankings: { sourceName: string; explanation: string | null }[];
      };
    };
    expect(body.data.niche.slug).toBe(slug);
    for (const metric of body.data.metrics) {
      expect(metric.sourceName).toBeTruthy();
      expect(metric.confidence).toBeTruthy();
    }
    for (const ranking of body.data.rankings) {
      expect(ranking.sourceName).toBeTruthy();
    }

    const missing = await request.get("/api/v1/niches/this-niche-does-not-exist");
    expect(missing.status()).toBe(404);
  });

  test("watchlist enforces ownership and de-duplicates entries", async ({ request }) => {
    await signIn(request, DEMO);
    const existing = await request.get("/api/v1/watchlist");
    expect(existing.status()).toBe(200);
    const list = (await existing.json()) as {
      data: { items: { watchlistId: string; slug: string }[] };
    };
    const saved = list.data.items[0];
    expect(saved).toBeTruthy();

    const duplicate = await request.post("/api/v1/watchlist", {
      data: { nicheSlug: saved.slug },
    });
    expect(duplicate.status()).toBe(409);

    // A second account must not be able to touch someone else's watchlist item.
    const email = `e2e-${Date.now()}@example.com`;
    const password = "IsolationPass123!";
    const other = await request.post("/api/auth/register", {
      data: { name: "E2E Isolation", email, password },
    });
    expect([200, 201, 409]).toContain(other.status());

    await signIn(request, { email, password });
    const ownList = await request.get("/api/v1/watchlist");
    const ownBody = (await ownList.json()) as { data: { items: unknown[] } };
    expect(ownBody.data.items).toHaveLength(0);

    const foreignDelete = await request.delete(`/api/v1/watchlist/${saved.watchlistId}`);
    expect(foreignDelete.status()).toBe(404);

    // Clean up the temporary account and its sessions.
    const deleted = await request.delete("/api/v1/account");
    expect(deleted.status()).toBe(200);
  });

  test("AI reports are structured, persisted and clearly labelled", async ({ request }) => {
    await signIn(request, DEMO);
    const response = await request.post("/api/v1/ai/analyze", {
      data: { nicheSlug: "ai-agents", type: "niche_analysis" },
    });
    expect([200, 201]).toContain(response.status());
    const body = (await response.json()) as {
      data: {
        reportId: string;
        provider: string;
        content: { overview?: string };
        offlineFixture: boolean;
        usage: { limit: number; remaining: number };
      };
    };
    expect(body.data.reportId).toBeTruthy();
    expect(body.data.content.overview).toBeTruthy();
    expect(body.data.usage.limit).toBeGreaterThan(0);

    const stored = await request.get(`/api/v1/ai/reports/${body.data.reportId}`);
    expect(stored.status()).toBe(200);
    const storedBody = (await stored.json()) as {
      data: { report: { provider: string; report: unknown } };
    };
    expect(storedBody.data.report.provider).toBe(body.data.provider);
  });

  test("admin routes are forbidden for regular users and available to admins", async ({
    request,
  }) => {
    await signIn(request, DEMO);
    const forbidden = await request.get("/api/v1/admin/users");
    expect(forbidden.status()).toBe(403);

    const adminCsrf = await request.get("/api/auth/csrf");
    const { csrfToken } = (await adminCsrf.json()) as { csrfToken: string };
    const callback = await request.post("/api/auth/callback/credentials", {
      form: {
        csrfToken,
        email: ADMIN.email,
        password: ADMIN.password,
        callbackUrl: "/admin",
      },
      maxRedirects: 0,
    });
    expect([200, 302]).toContain(callback.status());

    const users = await request.get("/api/v1/admin/users");
    expect(users.status()).toBe(200);
    const usersBody = (await users.json()) as { data: { email: string }[] };
    expect(usersBody.data.some((user) => user.email === ADMIN.email)).toBe(true);

    const categories = await request.get("/api/v1/admin/categories");
    expect(categories.status()).toBe(200);
    const categoriesBody = (await categories.json()) as {
      data: { slug: string; nicheCount: number }[];
    };
    expect(categoriesBody.data.length).toBeGreaterThan(0);
    expect(categoriesBody.data[0].nicheCount).toBeGreaterThanOrEqual(0);

    const niches = await request.get("/api/v1/admin/niches?pageSize=5");
    expect(niches.status()).toBe(200);
    const nichesBody = (await niches.json()) as {
      data: { id: string; categoryName: string }[];
      meta: { total: number };
    };
    expect(nichesBody.data.length).toBeLessThanOrEqual(5);
    expect(nichesBody.meta.total).toBeGreaterThan(0);

    const invalidCreate = await request.post("/api/v1/admin/categories", {
      data: { name: "x" },
    });
    expect(invalidCreate.status()).toBe(400);

    const compliance = await request.get("/api/v1/admin/compliance");
    expect(compliance.status()).toBe(200);
    const complianceBody = (await compliance.json()) as {
      data: {
        youtubeApprovalStatus: string;
        matrix: { uses: Record<string, { allowed: boolean; reason: string }> }[];
      };
    };
    expect(complianceBody.data.youtubeApprovalStatus).toBeDefined();
    for (const row of complianceBody.data.matrix) {
      for (const use of Object.values(row.uses)) {
        expect(typeof use.allowed).toBe("boolean");
        expect(use.reason.length).toBeGreaterThan(0);
      }
    }
  });
});
