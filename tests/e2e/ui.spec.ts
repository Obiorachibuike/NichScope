import { expect, test, type Page } from "@playwright/test";

async function login(page: Page, email = "demo@nichscope.app") {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("NicheScope123!");
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL("**/dashboard", { timeout: 20_000 });
}

test.describe("authentication", () => {
  test("anonymous visitors are redirected from the dashboard to login", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login\?/);
    await expect(page.getByRole("heading", { name: /welcome back|sign in/i })).toBeVisible();
  });

  test("demo credentials reach the dashboard", async ({ page }) => {
    await login(page);
    await expect(page.getByRole("heading", { name: /welcome back, demo/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /niche explorer/i }).first()).toBeVisible();
    await expect(page.getByText(/data freshness/i).first()).toBeVisible();
  });

  test("invalid credentials show an accessible error", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("demo@nichscope.app");
    await page.getByLabel("Password").fill("wrong-password-123");
    await page.getByRole("button", { name: /^sign in$/i }).click();
    await expect(page.getByRole("alert")).toContainText(/invalid|incorrect|failed/i);
  });
});

test.describe("research workflow", () => {
  test("filters persist in the URL and open a niche detail page", async ({ page }) => {
    await login(page);
    await page.goto("/niches");
    await expect(page.getByRole("heading", { name: /niche explorer/i })).toBeVisible();

    const search = page.getByPlaceholder(/niche, alias or keyword/i);
    await search.fill("ai");
    await page.waitForURL(/q=ai/, { timeout: 15_000 });

    const firstCard = page.locator('a[href^="/niches/"]').filter({ hasNotText: /^Niches$/ }).first();
    await expect(firstCard).toBeVisible();
    await firstCard.click();
    await page.waitForURL(/\/niches\/[a-z0-9-]+/);

    await expect(page.getByRole("tab", { name: /overview/i })).toBeVisible();
    await page.getByRole("tab", { name: /videos/i }).click();
    await expect(page.getByText(/video records are individual public metadata rows/i)).toBeVisible();
  });

  test("global search returns grouped results or an explicit empty state", async ({ page }) => {
    await login(page);
    await page.goto("/search?q=ai");
    await expect(page.getByRole("heading", { name: /results for/i })).toBeVisible();
    const hasResults = await page.getByText(/^Niches$/i).first().isVisible().catch(() => false);
    if (!hasResults) {
      await expect(page.getByText(/no results/i)).toBeVisible();
    }
  });

  test("saved niches shows the watchlist with notes controls", async ({ page }) => {
    await login(page);
    await page.goto("/saved");
    await expect(page.getByRole("heading", { name: /saved niches/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /edit notes/i }).first()).toBeVisible();
  });
});

test.describe("AI advisor", () => {
  test("generates a clearly labelled report from permitted evidence", async ({ page }) => {
    await login(page);
    await page.goto("/advisor");
    await expect(page.getByRole("heading", { name: /ai niche advisor/i })).toBeVisible();
    await page.getByRole("button", { name: /generate report/i }).click();
    await expect(page.getByText(/verified evidence|verified facts/i).first()).toBeVisible({
      timeout: 40_000,
    });
    await expect(page.getByText(/AI recommendations/i).first()).toBeVisible();
  });
});

test.describe("administration", () => {
  test("admin dashboard renders governance data for an administrator", async ({ page }) => {
    await login(page, "admin@nichscope.app");
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: /admin dashboard/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /data sources/i })).toBeVisible();
    await page.getByRole("link", { name: /compliance/i }).click();
    await expect(page.getByText(/effective use matrix/i)).toBeVisible();
    await expect(page.getByText(/30 days/i).first()).toBeVisible();
  });
});
