import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [
    {
      // Protocol-level end-to-end coverage. Runs without a browser binary and is
      // safe in minimal CI images.
      name: "api",
      testMatch: /api\.spec\.ts/,
    },
    {
      name: "chromium",
      testMatch: /ui\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: baseURL,
    reuseExistingServer: true,
    timeout: 180_000,
    env: {
      DEMO_MODE: "true",
      AUTH_SECRET: process.env.AUTH_SECRET ?? "playwright-test-secret-value-32-chars",
      NEXT_PUBLIC_APP_URL: baseURL,
      AUTH_LOGIN_MAX_PER_MINUTE: "100",
    },
  },
});
