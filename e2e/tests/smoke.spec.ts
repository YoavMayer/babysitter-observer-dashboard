import { test, expect } from "@playwright/test";

test.describe("Smoke Test", () => {
  test("dashboard loads and displays content", async ({ page }) => {
    // Navigate to the dashboard - increase timeout for first compile
    await page.goto("/", { timeout: 60_000 });

    // Wait for the heading to appear
    const heading = page.getByRole("heading", { name: "Babysitter Observer" });
    await expect(heading).toBeVisible({ timeout: 30_000 });

    // Wait for loading skeletons to disappear
    await page
      .locator(".animate-pulse")
      .first()
      .waitFor({ state: "hidden", timeout: 30_000 })
      .catch(() => {
        // Skeletons may never appear if data loads fast enough
      });

    // Verify the project grid is visible (contains project health cards)
    const projectGrid = page.locator(
      ".grid.grid-cols-1.sm\\:grid-cols-2.lg\\:grid-cols-3"
    );
    await expect(projectGrid).toBeVisible({ timeout: 30_000 });

    // Verify the page has at least one project card with content
    const projectCards = projectGrid.locator("> *");
    await expect(projectCards.first()).toBeVisible({ timeout: 10_000 });
  });
});
