import { defineConfig, devices } from "@playwright/test";
import path from "path";

/**
 * Playwright E2E configuration for the Observer dashboard.
 *
 * The webServer is started with WATCH_DIR pointing to the fixture runs
 * directory so that the observer dashboard displays deterministic test data.
 *
 * @see https://playwright.dev/docs/test-configuration
 */

const fixtureRunsDir = path.resolve(__dirname, "e2e/fixtures/runs");

export default defineConfig({
  testDir: "e2e/tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 1,
  workers: process.env.CI ? 1 : undefined,

  timeout: 90_000,

  reporter: [["html", { open: "never" }]],

  use: {
    baseURL: `http://localhost:${process.env.OBSERVER_PORT || "3000"}`,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: {
    command: "npm run dev",
    port: parseInt(process.env.OBSERVER_PORT || "3000", 10),
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      WATCH_DIR: fixtureRunsDir,
      OBSERVER_REGISTRY: path.resolve(__dirname, "e2e/fixtures/.observer-test.json"),
      PORT: process.env.OBSERVER_PORT || "3000",
      OBSERVER_STALE_THRESHOLD_MS: "999999999999",
    },
  },
});
