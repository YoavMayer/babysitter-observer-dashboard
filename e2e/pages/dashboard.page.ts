import { type Page, type Locator, expect } from "@playwright/test";

/**
 * Page Object for the Observer Dashboard (/).
 *
 * Encapsulates selectors and actions for the main dashboard view
 * including project health cards, KPI metric tiles, filter pills,
 * and run cards.
 */
export class DashboardPage {
  readonly page: Page;

  /* ---- Top-level locators ---- */

  /** The page header containing the title and controls. */
  readonly header: Locator;

  /** The "Babysitter Observer" heading text. */
  readonly heading: Locator;

  /** The grid of KPI metric tiles (Total Runs, Active, Completed, Failed). */
  readonly kpiGrid: Locator;

  /** The row of status filter pill buttons. */
  readonly filterBar: Locator;

  /** The grid container holding ProjectHealthCard components. */
  readonly projectGrid: Locator;

  /** The project count label (e.g. "4 projects"). */
  readonly projectCount: Locator;

  /** Loading skeleton placeholders shown while data loads. */
  readonly loadingSkeletons: Locator;

  /** Error banner shown when project loading fails. */
  readonly errorBanner: Locator;

  /** Empty state shown when no projects match. */
  readonly emptyState: Locator;

  /** Settings button in the top bar. */
  readonly settingsButton: Locator;

  /** Theme toggle button in the top bar. */
  readonly themeToggle: Locator;

  /** SSE connection status indicator dot. */
  readonly connectionDot: Locator;

  constructor(page: Page) {
    this.page = page;
    this.header = page.locator("header");
    this.heading = page.getByRole("heading", { name: "Babysitter Observer" });
    this.kpiGrid = page.getByTestId("kpi-grid");
    this.filterBar = page.getByTestId("filter-bar");
    this.projectGrid = page.getByTestId("project-grid");
    this.projectCount = page.getByTestId("project-count");
    this.loadingSkeletons = page.locator(".animate-pulse");
    this.errorBanner = page.getByTestId("error-banner");
    this.emptyState = page.getByTestId("empty-state");
    this.settingsButton = page.getByTitle("Settings");
    this.themeToggle = page.locator("button").filter({ hasText: /Switch to/ });
    this.connectionDot = page.locator("[title*='Live updates']");
  }

  /* ---- Navigation ---- */

  /** Navigate to the dashboard root. */
  async goto() {
    await this.page.goto("/");
  }

  /* ---- Queries ---- */

  /**
   * Return all visible ProjectHealthCard elements.
   * Each card is a `<div>` rendered by the `Card` component inside
   * `ProjectHealthCard`.
   */
  getProjectCards(): Locator {
    return this.projectGrid.locator("> *");
  }

  /**
   * Return all visible RunCard link elements.
   * RunCards are rendered as `<a>` tags wrapping a Card inside each
   * expanded ProjectHealthCard.
   */
  getRunCards(): Locator {
    return this.page.locator('a[href^="/runs/"]');
  }

  /**
   * Click a specific run card to navigate to the run detail page.
   * @param runId - The run ID (or partial ID) to locate the card.
   */
  async clickRun(runId: string) {
    await this.page.locator(`a[href="/runs/${runId}"]`).click();
  }

  /**
   * Return KPI metric tile elements.
   * These are the 4-column grid items: Total Runs, Active, Completed, Failed.
   */
  getKPITiles(): Locator {
    return this.kpiGrid.locator("> *");
  }

  /**
   * Return a specific KPI metric tile by its label.
   * @param label - One of "total-runs", "active", "completed", "failed".
   */
  getMetricTile(label: string): Locator {
    return this.page.getByTestId(`metric-tile-${label}`);
  }

  /**
   * Return a specific project health card by project name.
   * @param projectName - The project name, e.g. "podcast-intel".
   */
  getProjectCard(projectName: string): Locator {
    return this.page.getByTestId(`project-card-${projectName}`);
  }

  /**
   * Return filter pill buttons (All, Running, Completed, Failed).
   */
  getFilterPills(): Locator {
    return this.filterBar.locator("button");
  }

  /**
   * Return a specific filter pill button by its data-testid value.
   * @param value - One of "all", "waiting", "completed", "failed".
   */
  getFilterPill(value: string): Locator {
    return this.page.getByTestId(`filter-pill-${value}`);
  }

  /**
   * Click a status filter pill by its label text.
   * @param status - One of "All", "Running", "Completed", "Failed".
   */
  async clickFilter(status: string) {
    await this.filterBar
      .locator("button")
      .filter({ hasText: status })
      .click();
  }

  /**
   * Type a search query into the project search/filter input.
   * Note: The dashboard page uses filter pills, not a search input.
   * If a ProjectSearchInput is embedded in a future version, this
   * targets `input[placeholder*="Filter"]` or the search input.
   */
  async searchProjects(query: string) {
    const searchInput = this.page.locator(
      'input[placeholder*="Filter"], input[placeholder*="Search"]'
    );
    await searchInput.fill(query);
  }

  /* ---- Waiters ---- */

  /**
   * Wait for initial data to finish loading.
   * Resolves once loading skeletons disappear and either project cards,
   * the error banner, or the empty state become visible.
   */
  async waitForData() {
    // Wait for skeletons to disappear (if they appeared)
    await this.loadingSkeletons.first().waitFor({ state: "hidden", timeout: 30_000 }).catch(() => {
      // Skeletons may never appear if data loads fast enough
    });

    // At least one of these states should be present
    await expect(
      this.projectGrid.or(this.errorBanner).or(this.emptyState)
    ).toBeVisible({ timeout: 30_000 });
  }
}
