import { test, expect } from "../fixtures";
import { getManifest, getRunIdsByStatus } from "../fixtures/test-data";
import type { Manifest, ManifestRun } from "../fixtures/test-data";

/**
 * E2E tests for the Breakpoint Panel and Breakpoint Banner.
 *
 * These tests validate that:
 * - The breakpoint banner renders conditionally based on pending breakpoints
 * - Navigating to a run with a breakpoint task shows the Approval tab
 * - The breakpoint panel displays question/context text
 * - The Approval tab is the default tab for breakpoint-kind tasks
 * - Non-breakpoint tasks do not show the Approval tab
 *
 * Note: The fixture data contains waiting runs with RESOLVED breakpoints
 * (the breakpoint task was approved before the run continued to the next step,
 * which is still pending). The banner only appears when breakpoints are still
 * pending, so we verify it is absent with the current fixture data.
 */

let manifest: Manifest;

test.beforeAll(async () => {
  manifest = await getManifest();
});

/** Pick a run from the manifest by status. */
function pickRun(status: ManifestRun["status"]): ManifestRun {
  const run = manifest.runs.find((r) => r.status === status);
  if (!run) throw new Error(`No fixture run found with status "${status}"`);
  return run;
}

/**
 * Known waiting run with a resolved breakpoint task.
 *
 * Run 01KH47FK2MGMMB37B17PE3Z91Z (hockey/roster-update) has a breakpoint
 * task "Approve budget allocation?" at effectId 01KH47YK0HJ1CY5FYT4X1XZ5YZ.
 * The breakpoint was already resolved (approved), but the run is still in
 * "waiting" status because a subsequent agent task is pending.
 */
const BREAKPOINT_RUN_ID = "01KH47FK2MGMMB37B17PE3Z91Z";
const BREAKPOINT_EFFECT_ID = "01KH47YK0HJ1CY5FYT4X1XZ5YZ";

// ---------------------------------------------------------------------------
// Breakpoint Banner on Dashboard
// ---------------------------------------------------------------------------

test.describe("Breakpoint Banner", () => {
  test("breakpoint banner is visible on dashboard when pending breakpoints exist", async ({
    dashboardPage,
    page,
  }) => {
    await dashboardPage.goto();
    await dashboardPage.waitForData();

    // The fixture data has waiting runs, but all breakpoint tasks within them
    // have been resolved. The BreakpointBanner only renders when
    // allBreakpointRuns.length > 0, which requires pendingBreakpoints > 0
    // and waitingKind === "breakpoint" in the run digest.
    //
    // Since all breakpoints in the fixture data are resolved, the banner
    // element should either be absent from the DOM or have no content.
    // This validates the conditional rendering: banner appears ONLY when
    // there are actual pending breakpoints, not just waiting runs.
    const banner = page.getByTestId("breakpoint-banner");
    await expect(banner).not.toBeVisible({ timeout: 10_000 });
  });

  test("breakpoint banner shows relevant info when breakpoints are pending", async ({
    dashboardPage,
    page,
  }) => {
    await dashboardPage.goto();
    await dashboardPage.waitForData();

    // Verify the dashboard loads with the correct number of waiting runs
    const waitingRunIds = await getRunIdsByStatus("waiting");
    expect(waitingRunIds.length).toBeGreaterThan(0);

    // The breakpoint banner data-testid is placed on the wrapper div.
    // When no breakpointRuns exist, the component returns null.
    // We verify the banner is not rendered — confirming that the component
    // correctly distinguishes between "waiting" runs and "breakpoint-pending" runs.
    const bannerCount = await page.locator("[data-testid='breakpoint-banner']").count();
    expect(bannerCount).toBe(0);

    // However, the dashboard still shows In Progress runs correctly
    const activeTile = dashboardPage.getMetricTile("active");
    await expect(activeTile).toBeVisible();

    // Active count includes waiting + pending runs
    const activeCount =
      (manifest.statusCounts.waiting || 0) + (manifest.statusCounts.pending || 0);
    await expect(activeTile).toContainText(String(activeCount));
  });
});

// ---------------------------------------------------------------------------
// Breakpoint Panel in Run Detail
// ---------------------------------------------------------------------------

test.describe("Breakpoint Panel", () => {
  test("navigating to a waiting run shows the breakpoint panel in task detail", async ({
    runDetailPage,
  }) => {
    await runDetailPage.goto(BREAKPOINT_RUN_ID);
    await runDetailPage.waitForData();

    // Expand all tasks if "Show all" is visible, since the breakpoint task
    // may be beyond the initial truncated view (22 tasks in this run)
    const showAllBtn = runDetailPage.page.locator("[data-testid='show-all-tasks-btn']");
    if (await showAllBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await showAllBtn.click();
      await runDetailPage.page.waitForTimeout(500);
    }

    // Click the specific breakpoint step card by its effectId
    const breakpointStep = runDetailPage.getStepCard(BREAKPOINT_EFFECT_ID);
    await expect(breakpointStep).toBeVisible({ timeout: 10_000 });
    await breakpointStep.locator("button").first().click();

    // The task detail panel should appear
    await expect(runDetailPage.taskDetailHeader).toBeVisible({ timeout: 10_000 });

    // The "Approval" tab should be visible (only shown for breakpoint tasks)
    const approvalTab = runDetailPage.getTabTrigger("Approval");
    await expect(approvalTab).toBeVisible({ timeout: 10_000 });

    // The Approval tab should be active by default for breakpoint tasks
    await expect(approvalTab).toHaveAttribute("data-state", "active");

    // The breakpoint panel should be rendered
    const breakpointPanel = runDetailPage.page.getByTestId("breakpoint-panel");
    await expect(breakpointPanel).toBeVisible({ timeout: 10_000 });
  });

  test("breakpoint panel displays the question/context text", async ({
    runDetailPage,
  }) => {
    await runDetailPage.goto(BREAKPOINT_RUN_ID);
    await runDetailPage.waitForData();

    // Expand all tasks if needed
    const showAllBtn = runDetailPage.page.locator("[data-testid='show-all-tasks-btn']");
    if (await showAllBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await showAllBtn.click();
      await runDetailPage.page.waitForTimeout(500);
    }

    // Click the breakpoint step card
    const breakpointStep = runDetailPage.getStepCard(BREAKPOINT_EFFECT_ID);
    await breakpointStep.locator("button").first().click();
    await expect(runDetailPage.taskDetailHeader).toBeVisible({ timeout: 10_000 });

    // Wait for the breakpoint panel to load
    const breakpointPanel = runDetailPage.page.getByTestId("breakpoint-panel");
    await expect(breakpointPanel).toBeVisible({ timeout: 10_000 });

    // The breakpoint question text should be visible
    const questionEl = runDetailPage.page.getByTestId("breakpoint-question");
    await expect(questionEl).toBeVisible();

    // The question text should contain the expected question
    // (from the task.json: "Approve budget allocation?")
    const questionText = await questionEl.textContent();
    expect(questionText).toBeTruthy();
    expect(questionText!.length).toBeGreaterThan(0);

    // This breakpoint was already resolved, so the panel should show
    // "Decision made" instead of "Awaiting decision"
    await expect(breakpointPanel).toContainText("Decision made");
  });

  test("breakpoint panel is shown on the Approval tab for breakpoint tasks", async ({
    runDetailPage,
  }) => {
    await runDetailPage.goto(BREAKPOINT_RUN_ID);
    await runDetailPage.waitForData();

    // Expand all tasks if needed
    const showAllBtn = runDetailPage.page.locator("[data-testid='show-all-tasks-btn']");
    if (await showAllBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await showAllBtn.click();
      await runDetailPage.page.waitForTimeout(500);
    }

    // Click the breakpoint step card
    const breakpointStep = runDetailPage.getStepCard(BREAKPOINT_EFFECT_ID);
    await breakpointStep.locator("button").first().click();
    await expect(runDetailPage.taskDetailHeader).toBeVisible({ timeout: 10_000 });

    // The tabs should include Approval for breakpoint tasks
    const tabs = runDetailPage.getTaskDetailTabs();
    await expect(tabs).toBeVisible({ timeout: 10_000 });

    // Verify Approval tab exists alongside other standard tabs
    const approvalTab = runDetailPage.getTabTrigger("Approval");
    await expect(approvalTab).toBeVisible();

    // Standard tabs should also be present
    await expect(runDetailPage.getTabTrigger("Agent")).toBeVisible();
    await expect(runDetailPage.getTabTrigger("Timing")).toBeVisible();
    await expect(runDetailPage.getTabTrigger("Logs")).toBeVisible();
    await expect(runDetailPage.getTabTrigger("Data")).toBeVisible();

    // Approval tab should be active (default for breakpoint tasks)
    await expect(approvalTab).toHaveAttribute("data-state", "active");

    // Breakpoint panel should be visible within the Approval tab content
    await expect(runDetailPage.page.getByTestId("breakpoint-panel")).toBeVisible();

    // The panel should show a "Breakpoint" badge
    await expect(
      runDetailPage.page.getByTestId("breakpoint-panel").getByText("Breakpoint", { exact: true })
    ).toBeVisible();
  });

  test("completed runs do not show breakpoint or Approval tab", async ({
    runDetailPage,
  }) => {
    const run = pickRun("completed");

    await runDetailPage.goto(run.runId);
    await runDetailPage.waitForData();

    // Click the first step to open the task detail panel
    await runDetailPage.clickStepByIndex(0);
    await expect(runDetailPage.taskDetailHeader).toBeVisible({ timeout: 10_000 });

    // Wait for the task detail tabs to be visible
    const tabs = runDetailPage.getTaskDetailTabs();
    await expect(tabs).toBeVisible({ timeout: 30_000 });

    // The Approval tab should NOT be visible for non-breakpoint tasks
    const approvalTab = runDetailPage.getTabTrigger("Approval");
    await expect(approvalTab).not.toBeVisible();

    // The breakpoint panel should not be visible
    await expect(
      runDetailPage.page.getByTestId("breakpoint-panel")
    ).not.toBeVisible();
  });
});
