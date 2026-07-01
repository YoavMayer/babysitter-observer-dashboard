import { test, expect } from "@playwright/test";

/**
 * D2 regression: the sticky header and the sticky breakpoint banner must NOT
 * overlap on scroll. Before the fix, both pinned to `top-0` (header z-30, banner
 * z-40) so the banner covered the header. The banner now pins below the header
 * (`top-14`), so their bounding boxes must not intersect vertically.
 *
 * Skips gracefully when no breakpoint banner is present (no waiting runs in the
 * watched dir) — the assertion only applies when the banner renders.
 */
test.describe("D2 sticky overlap", () => {
  test("header and breakpoint banner do not overlap on scroll", async ({ page }) => {
    await page.goto("/", { timeout: 60_000, waitUntil: "domcontentloaded" });

    const header = page.locator("header").first();
    await expect(header).toBeVisible({ timeout: 30_000 });

    const banner = page.getByTestId("breakpoint-banner").first();
    const hasBanner = await banner.count().then((c) => c > 0).catch(() => false);
    test.skip(!hasBanner, "No breakpoint banner present (no waiting runs to pin).");

    // BEFORE proof (top of page).
    await page.screenshot({ path: "e2e-proof/d2-before-scroll.png" });

    // Scroll down so both sticky elements are engaged.
    await page.mouse.wheel(0, 1200);
    await page.waitForTimeout(300);

    // AFTER proof (scrolled — this is where the old overlap showed).
    await page.screenshot({ path: "e2e-proof/d2-after-scroll.png" });

    const hb = await header.boundingBox();
    const bb = await banner.boundingBox();
    expect(hb, "header box").not.toBeNull();
    expect(bb, "banner box").not.toBeNull();
    if (hb && bb) {
      // Banner top must sit at/below the header bottom — no vertical overlap.
      expect(bb.y).toBeGreaterThanOrEqual(hb.y + hb.height - 1);
    }
  });
});
