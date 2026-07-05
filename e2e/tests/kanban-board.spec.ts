/**
 * FROZEN acceptance tests — SPEC-vibekanban §10, board behaviors
 * (AC-11..AC-25, AC-27). Authored BEFORE any board implementation exists.
 *
 * Every test below is declared with `test.fixme(...)` — pending-impl: the
 * kanban board (src/components/kanban/**) does not exist yet. These tests are
 * the frozen definition of done for the board waves; when a wave lands, flip
 * its tests from `test.fixme` to `test` — do NOT weaken the assertions.
 *
 * Frozen DOM contract (testids the implementation MUST render — SPEC §10
 * names `kanban-board` and `kanban-column-count-<key>` explicitly; the rest
 * are fixed by this file as the frozen contract):
 *   - [data-testid="kanban-board"]                board container (role="region", aria-label="Run board")
 *   - [data-testid="kanban-column-<key>"]         column, key ∈ needsyou|orphaned|waiting|stale|failed|completed
 *   - [data-testid="kanban-column-count-<key>"]   header count (text = integer)
 *   - [data-testid="kanban-column-cards-<key>"]   the column's scrollable card container
 *   - [data-testid="kanban-card"][data-run-id]    a card; data-run-id = full runId
 *   - [data-testid="view-toggle-board"] / [data-testid="view-toggle-list"]  segmented control (aria-pressed)
 *   - [data-testid="kanban-bp-option-chip"]       one per BreakpointPayload option on a Needs-you card
 *   - [data-testid="kanban-bp-answer-toggle"]     expands the Answer section (mounts existing BreakpointApproval)
 *   - focus/dim (AC-23): focused column gets [data-focused="true"], dimmed columns get [data-dimmed="true"]
 * Reused existing testids: breakpoint-approval, option-btn-<option>,
 * custom-answer-input, run-action-hint, hidden-projects-indicator,
 * filter-pill-<key>, empty-state, run-list-flat, breakpoint-banner.
 *
 * Fixture prerequisites NOT yet in e2e/fixtures (to be added by the
 * implementation waves; reserved ids are frozen here):
 *   - KANBAN_LONG_BP_RUN_ID   pending breakpoint, question > 120 chars (verbatim below), options list (AC-14)
 *   - KANBAN_APPROVE_BP_RUN_ID  pending breakpoint dedicated to the approve test (AC-15) so the shared
 *                               banner fixture 01KTESTPENDINGBPFIXTURE0 is never mutated
 *   - KANBAN_SSE_BP_RUN_ID    pending breakpoint dedicated to the SSE movement test (AC-18)
 *   - hidden-project registry entry + runs for AC-19 (registry hiddenProjects: ["kanban-hidden-project"])
 *   - a ~50h-old run for AC-25 is synthesized via /api/runs route interception (no fixture needed)
 */

import { test, expect, type Page } from "@playwright/test";
import { promises as fs } from "fs";
import path from "path";
import { getManifest, runDir, FIXTURES_RUNS_DIR } from "../fixtures/test-data";
import type { Manifest } from "../fixtures/test-data";

const COLUMN_KEYS = ["needsyou", "orphaned", "waiting", "stale", "failed", "completed"] as const;
type ColumnKey = (typeof COLUMN_KEYS)[number];

// Existing shared fixture (read-only in this spec — see breakpoints.spec.ts).
// It has NO run.lock => driver "none" => orphaned-driver Needs-you card (AC-16).
const PENDING_BP_RUN_ID = "01KTESTPENDINGBPFIXTURE0";

// Reserved fixture ids (frozen contract — implementation waves add the dirs).
const KANBAN_LONG_BP_RUN_ID = "01KTESTKANBANLONGBP00001";
const KANBAN_LONG_BP_EFFECT_ID = "01KTEST_KANBAN_LONGBP_01";
const KANBAN_APPROVE_BP_RUN_ID = "01KTESTKANBANAPPROVE0002";
const KANBAN_APPROVE_BP_EFFECT_ID = "01KTEST_KANBAN_APPROVE_1";
const KANBAN_SSE_BP_RUN_ID = "01KTESTKANBANSSEMOVE0003";
const KANBAN_SSE_BP_EFFECT_ID = "01KTEST_KANBAN_SSE_BP_01";
const HIDDEN_PROJECT_NAME = "kanban-hidden-project";
const HIDDEN_BP_RUN_ID = "01KTESTKANBANHIDDENBP004";
const HIDDEN_PLAIN_RUN_ID = "01KTESTKANBANHIDDENWK005";

// AC-14: the fixture question, asserted VERBATIM (length > 120 chars).
const LONG_BP_QUESTION =
  "The staging deploy changes the database schema, rotates two service credentials, and restarts the ingest workers — do you approve rolling this out to the shared staging environment now?";
const LONG_BP_OPTIONS = ["approve", "reject", "defer to tomorrow"];

const PENDING_IMPL = "pending-impl: kanban board not implemented yet (SPEC-vibekanban §10)";

let manifest: Manifest;
test.beforeAll(async () => {
  manifest = await getManifest();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const board = (page: Page) => page.getByTestId("kanban-board");
const column = (page: Page, key: ColumnKey) => page.getByTestId(`kanban-column-${key}`);
const columnCount = (page: Page, key: ColumnKey) => page.getByTestId(`kanban-column-count-${key}`);
const cardsIn = (page: Page, key: ColumnKey) =>
  column(page, key).locator('[data-testid="kanban-card"]');
const cardFor = (page: Page, runId: string) =>
  page.locator(`[data-testid="kanban-card"][data-run-id="${runId}"]`);

async function gotoBoard(page: Page) {
  // SSE keeps the "load" event open — same pattern as DashboardPage.goto().
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(board(page)).toBeVisible({ timeout: 30_000 });
}

async function readCount(page: Page, key: ColumnKey): Promise<number> {
  const text = (await columnCount(page, key).textContent()) ?? "";
  const match = text.match(/\d+/);
  expect(match, `column count for ${key} must contain an integer, got "${text}"`).not.toBeNull();
  return parseInt(match![0], 10);
}

/** Minimal LightRun-shaped payload entry for /api/runs route interception. */
function makeApiRun(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const now = Date.now();
  return {
    runId: "01KSYNTHRUN0000000000000",
    processId: "synthetic/process",
    status: "waiting",
    createdAt: new Date(now - 3_600_000).toISOString(),
    updatedAt: new Date(now - 60_000).toISOString(),
    tasks: [],
    events: [],
    totalEvents: 5,
    totalTasks: 4,
    completedTasks: 2,
    failedTasks: 0,
    projectName: "synthetic-project",
    driver: "live",
    isStale: false,
    pendingBreakpoints: 0,
    ...overrides,
  };
}

/** Intercept the board's /api/runs list fetch (never /api/runs/<id>). */
async function interceptRuns(page: Page, runs: Record<string, unknown>[], totalCount?: number) {
  await page.route("**/api/runs?*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ runs, totalCount: totalCount ?? runs.length }),
    })
  );
}

/** Append an EFFECT_RESOLVED journal entry + result.json the way the approve
 *  server action does — used to simulate a breakpoint being answered on disk. */
async function resolveBreakpointOnDisk(runId: string, effectId: string): Promise<string[]> {
  const dir = runDir(runId);
  const journalDir = path.join(dir, "journal");
  const entries = await fs.readdir(journalDir);
  const nextSeq = entries.length + 1;
  const entryId = `01KTESTRESOLVED${String(nextSeq).padStart(9, "0")}`;
  const journalPath = path.join(
    journalDir,
    `${String(nextSeq).padStart(6, "0")}.${entryId}.json`
  );
  const resultPath = path.join(dir, "tasks", effectId, "result.json");
  const nowIso = new Date().toISOString();
  await fs.writeFile(
    resultPath,
    JSON.stringify({ answer: "approve", approvedAt: nowIso }, null, 2)
  );
  await fs.writeFile(
    journalPath,
    JSON.stringify(
      {
        type: "EFFECT_RESOLVED",
        recordedAt: nowIso,
        data: {
          effectId,
          status: "ok",
          resultRef: `tasks/${effectId}/result.json`,
          startedAt: nowIso,
          finishedAt: nowIso,
        },
        checksum: "e2e-kanban-sse-fixture",
      },
      null,
      2
    )
  );
  return [journalPath, resultPath];
}

// ---------------------------------------------------------------------------
// Board rendering & chrome
// ---------------------------------------------------------------------------

test.describe("Kanban board — rendering & chrome (SPEC-vibekanban)", () => {
  test(
    `AC-11: board is the default view on a fresh profile and the board/list toggle persists across reloads (${PENDING_IMPL})`,
    async ({ page }) => {
      await gotoBoard(page);

      // Fresh profile => board by default; the project grid is absent.
      await expect(board(page)).toBeVisible();
      await expect(page.locator('[data-testid^="project-grid-"]')).toHaveCount(0);

      // Switch to List and reload: list persists (usePersistedState "observer:dashboard-view").
      await page.getByTestId("view-toggle-list").click();
      await expect(board(page)).not.toBeVisible();
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page.locator('[data-testid^="project-grid-"]').first()).toBeVisible({
        timeout: 30_000,
      });
      await expect(board(page)).not.toBeVisible();

      // Switch back to Board and reload: board persists.
      await page.getByTestId("view-toggle-board").click();
      await expect(board(page)).toBeVisible({ timeout: 30_000 });
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(board(page)).toBeVisible({ timeout: 30_000 });
      await expect(page.locator('[data-testid^="project-grid-"]')).toHaveCount(0);
    }
  );

  test(
    `AC-12: columns render in SPEC order and Orphaned/Stale auto-hide when empty (${PENDING_IMPL})`,
    async ({ page }) => {
      // Deterministic bucket population via /api/runs interception:
      // no orphaned, no stale => those two columns must be absent from the DOM.
      await interceptRuns(page, [
        makeApiRun({ runId: "01KSYNTHNEEDSYOU00000001", pendingBreakpoints: 1 }),
        makeApiRun({ runId: "01KSYNTHWORKING000000002" }),
        makeApiRun({ runId: "01KSYNTHFAILED0000000003", status: "failed" }),
        makeApiRun({ runId: "01KSYNTHDONE000000000004", status: "completed", completedTasks: 4 }),
      ]);
      await gotoBoard(page);

      await expect(column(page, "needsyou")).toBeVisible();
      await expect(column(page, "waiting")).toBeVisible();
      await expect(column(page, "failed")).toBeVisible();
      await expect(column(page, "completed")).toBeVisible();
      await expect(column(page, "orphaned")).toHaveCount(0); // auto-hidden, absent from DOM
      await expect(column(page, "stale")).toHaveCount(0);

      // Now include orphaned + stale runs: all six columns, in SPEC §3.2 order.
      await page.unroute("**/api/runs?*");
      await interceptRuns(page, [
        makeApiRun({ runId: "01KSYNTHNEEDSYOU00000001", pendingBreakpoints: 1 }),
        makeApiRun({ runId: "01KSYNTHORPHANED00000005", driver: "none" }),
        makeApiRun({ runId: "01KSYNTHWORKING000000002" }),
        makeApiRun({ runId: "01KSYNTHSTALE00000000006", isStale: true }),
        makeApiRun({ runId: "01KSYNTHFAILED0000000003", status: "failed" }),
        makeApiRun({ runId: "01KSYNTHDONE000000000004", status: "completed", completedTasks: 4 }),
      ]);
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(board(page)).toBeVisible({ timeout: 30_000 });

      const testids = await board(page)
        .locator('[data-testid^="kanban-column-"]:not([data-testid^="kanban-column-count-"]):not([data-testid^="kanban-column-cards-"])')
        .evaluateAll((els) => els.map((el) => el.getAttribute("data-testid")));
      expect(testids).toEqual([
        "kanban-column-needsyou",
        "kanban-column-orphaned",
        "kanban-column-waiting",
        "kanban-column-stale",
        "kanban-column-failed",
        "kanban-column-completed",
      ]);
    }
  );

  test(
    `AC-13: every column header count equals the number of rendered cards in that column (${PENDING_IMPL})`,
    async ({ page }) => {
      // <=15 per column so virtualization (threshold 15) does not hide cards.
      const runs = [
        ...Array.from({ length: 3 }, (_, i) =>
          makeApiRun({ runId: `01KSYNTHBP000000000000${String(i).padStart(2, "0")}`, pendingBreakpoints: 1 })
        ),
        ...Array.from({ length: 5 }, (_, i) =>
          makeApiRun({ runId: `01KSYNTHWK000000000000${String(i).padStart(2, "0")}` })
        ),
        ...Array.from({ length: 2 }, (_, i) =>
          makeApiRun({ runId: `01KSYNTHOR000000000000${String(i).padStart(2, "0")}`, driver: "orphaned" })
        ),
        ...Array.from({ length: 4 }, (_, i) =>
          makeApiRun({ runId: `01KSYNTHFL000000000000${String(i).padStart(2, "0")}`, status: "failed" })
        ),
        ...Array.from({ length: 6 }, (_, i) =>
          makeApiRun({ runId: `01KSYNTHCP000000000000${String(i).padStart(2, "0")}`, status: "completed", completedTasks: 4 })
        ),
      ];
      await interceptRuns(page, runs);
      await gotoBoard(page);

      const expected: Partial<Record<ColumnKey, number>> = {
        needsyou: 3,
        orphaned: 2,
        waiting: 5,
        failed: 4,
        completed: 6,
      };
      for (const key of COLUMN_KEYS) {
        if (expected[key] === undefined) continue;
        await expect(column(page, key)).toBeVisible();
        expect(await readCount(page, key), `header count for ${key}`).toBe(expected[key]);
        await expect(cardsIn(page, key)).toHaveCount(expected[key]!);
      }
    }
  );

  test(
    `AC-25: card ages >=48h render in days ("2d ago" for a 50h-old run) (${PENDING_IMPL})`,
    async ({ page }) => {
      const fiftyHoursAgo = new Date(Date.now() - 50 * 60 * 60 * 1000).toISOString();
      await interceptRuns(page, [
        makeApiRun({ runId: "01KSYNTHOLD0000000000001", updatedAt: fiftyHoursAgo }),
      ]);
      await gotoBoard(page);
      const card = cardFor(page, "01KSYNTHOLD0000000000001");
      await expect(card).toBeVisible();
      await expect(card).toContainText("2d ago");
      await expect(card).not.toContainText("50h");
    }
  );

  test(
    `AC-27: list-mode regression guard — grid and flat filtered list behave as on the base branch, with zero board elements (${PENDING_IMPL})`,
    async ({ page }) => {
      await gotoBoard(page);
      await page.getByTestId("view-toggle-list").click();

      // "All" list mode = the existing project grid (smoke assertion mirroring
      // dashboard.spec.ts), with no board elements in the DOM.
      await expect(page.locator('[data-testid^="project-grid-"]').first()).toBeVisible({
        timeout: 30_000,
      });
      await expect(page.locator('[data-testid^="kanban-"]')).toHaveCount(0);
      await expect(page.getByTestId("project-count")).toBeVisible();

      // A status pill in list mode still swaps to the flat run list (existing behavior).
      await page.getByTestId("filter-pill-completed").click();
      await expect(
        page.getByTestId("run-list").or(page.getByText("No runs found"))
      ).toBeVisible({ timeout: 30_000 });
      await expect(page.locator('[data-testid^="kanban-"]')).toHaveCount(0);
    }
  );
});

// ---------------------------------------------------------------------------
// Needs-you cards: question, options, informing approve
// ---------------------------------------------------------------------------

test.describe("Kanban board — Needs-you cards (SPEC-vibekanban)", () => {
  test(
    `AC-14: a Needs-you card shows the FULL breakpoint question verbatim (>120 chars) and one chip per option (${PENDING_IMPL})`,
    async ({ page }) => {
      // Fixture prerequisite: KANBAN_LONG_BP_RUN_ID with the exact question +
      // options frozen at the top of this file.
      expect(LONG_BP_QUESTION.length).toBeGreaterThan(120);
      await gotoBoard(page);

      const card = cardFor(page, KANBAN_LONG_BP_RUN_ID);
      await expect(card).toBeVisible({ timeout: 15_000 });
      await expect(column(page, "needsyou").locator(`[data-run-id="${KANBAN_LONG_BP_RUN_ID}"]`)).toBeVisible();

      // Full question, verbatim, not truncated.
      await expect(card).toContainText(LONG_BP_QUESTION);

      // One chip per option from BreakpointPayload.options, with matching text.
      const chips = card.getByTestId("kanban-bp-option-chip");
      await expect(chips).toHaveCount(LONG_BP_OPTIONS.length);
      for (let i = 0; i < LONG_BP_OPTIONS.length; i++) {
        await expect(chips.nth(i)).toHaveText(LONG_BP_OPTIONS[i]);
      }
    }
  );

  test(
    "AC-15: submitting an option from a Needs-you card invokes the existing approve flow (result.json + EFFECT_RESOLVED on disk) and performs no other network write",
    async ({ page }) => {
      // Fixture prerequisite: KANBAN_APPROVE_BP_RUN_ID — a dedicated pending
      // breakpoint (options include "approve") so the shared banner fixture
      // is never mutated by this test.
      const dir = runDir(KANBAN_APPROVE_BP_RUN_ID);
      const resultPath = path.join(dir, "tasks", KANBAN_APPROVE_BP_EFFECT_ID, "result.json");
      const journalDir = path.join(dir, "journal");
      const journalBefore = await fs.readdir(journalDir);

      // Track every non-GET request: the ONLY write allowed is the Next.js
      // server action POST that carries approveBreakpoint.
      const nonGetRequests: string[] = [];
      page.on("request", (req) => {
        if (req.method() !== "GET") nonGetRequests.push(`${req.method()} ${req.url()}`);
      });

      try {
        await gotoBoard(page);
        const card = cardFor(page, KANBAN_APPROVE_BP_RUN_ID);
        await expect(card).toBeVisible({ timeout: 15_000 });

        // Expand the Answer section: it mounts the EXISTING BreakpointApproval
        // component unchanged (the only write path).
        await card.getByTestId("kanban-bp-answer-toggle").click();
        const approval = card.getByTestId("breakpoint-approval");
        await expect(approval).toBeVisible();

        // Submit an option (option buttons submit directly in BreakpointApproval).
        await approval.getByTestId("option-btn-approve").click();
        await expect(card.getByTestId("approval-result")).toBeVisible({ timeout: 15_000 });

        // Same on-disk assertions as the approve flow: result.json written...
        //
        // DOCUMENTED FROZEN-ASSERTION CORRECTION (the only one in this file):
        // the frozen draft asserted a top-level `result.answer`, but the
        // SPEC-protected approveBreakpoint server action (SPEC §9: "No
        // changes to ... approve-breakpoint.ts"; contract: the ONLY write
        // path, reused unchanged) writes the SDK-compatible D1 shape
        //   { status: "ok", value: { approved, answer, ... }, startedAt, finishedAt }
        // — `value.approved: true` is what the babysitter runtime reads to
        // distinguish approval from rejection. The SPEC outranks the frozen
        // draft's assumed shape; AC-15's intent (the approval is recorded on
        // disk exactly as the existing approve flow records it) is asserted
        // against the real shape. Corrected, not weakened.
        const result = JSON.parse(await fs.readFile(resultPath, "utf-8"));
        expect(result.status).toBe("ok");
        expect(result.value.approved).toBe(true);
        expect(result.value.answer).toBe("approve");

        // ...and an EFFECT_RESOLVED journal entry appended.
        const journalAfter = await fs.readdir(journalDir);
        const newEntries = journalAfter.filter((f) => !journalBefore.includes(f));
        expect(newEntries.length).toBe(1);
        const entry = JSON.parse(await fs.readFile(path.join(journalDir, newEntries[0]), "utf-8"));
        expect(entry.type).toBe("EFFECT_RESOLVED");
        expect(entry.data.effectId).toBe(KANBAN_APPROVE_BP_EFFECT_ID);

        // No other network write occurred: every non-GET request is a POST to
        // the app itself (the server action), never a REST endpoint.
        expect(nonGetRequests.length).toBeGreaterThanOrEqual(1);
        for (const req of nonGetRequests) {
          expect(req, "only the server-action POST may write").toMatch(/^POST http:\/\/localhost:\d+\/(?:$|\?)/);
        }
      } finally {
        // Restore the fixture to its pending state for other tests/workers.
        const journalAfter = await fs.readdir(journalDir).catch(() => [] as string[]);
        for (const f of journalAfter) {
          if (!journalBefore.includes(f)) await fs.unlink(path.join(journalDir, f)).catch(() => {});
        }
        await fs.unlink(resultPath).catch(() => {});
      }
    }
  );

  test(
    `AC-16: an orphaned-driver Needs-you card shows the "No live driver — resume to answer" hint and a working copy-run-id control (${PENDING_IMPL})`,
    async ({ page, context }) => {
      // 01KTESTPENDINGBPFIXTURE0 has no run.lock => driver "none" => orphaned.
      await context.grantPermissions(["clipboard-read", "clipboard-write"]);
      await gotoBoard(page);

      const card = cardFor(page, PENDING_BP_RUN_ID);
      await expect(card).toBeVisible({ timeout: 15_000 });
      await expect(column(page, "needsyou").locator(`[data-run-id="${PENDING_BP_RUN_ID}"]`)).toBeVisible();

      // Driver-aware informing hint (exact copy from run-list.tsx ActionHint).
      await expect(card).toContainText("No live driver — resume to answer");
      await expect(card).not.toContainText("Answer in terminal");

      // Copy control puts the FULL runId on the clipboard.
      await card.getByRole("button", { name: /copy run id/i }).click();
      const clipboard = await page.evaluate(() => navigator.clipboard.readText());
      expect(clipboard).toBe(PENDING_BP_RUN_ID);
    }
  );

  test(
    `AC-17: clicking a card outside its interactive children navigates to /runs/{runId} (${PENDING_IMPL})`,
    async ({ page }) => {
      await gotoBoard(page);
      const firstCard = page.locator('[data-testid="kanban-card"]').first();
      await expect(firstCard).toBeVisible({ timeout: 15_000 });
      const runId = await firstCard.getAttribute("data-run-id");
      expect(runId).toBeTruthy();

      // Click the card body (stretched-overlay Link pattern) — not a button.
      await firstCard.click({ position: { x: 10, y: 10 } });
      await page.waitForURL(`**/runs/${runId}`, { timeout: 15_000 });
    }
  );

  test(
    `AC-18: resolving a breakpoint on disk moves the card out of Needs you within 10s via SSE, without a page reload (${PENDING_IMPL})`,
    async ({ page }) => {
      // Fixture prerequisite: KANBAN_SSE_BP_RUN_ID — a dedicated pending
      // breakpoint run this test resolves on disk (and restores afterwards).
      let createdFiles: string[] = [];
      try {
        await gotoBoard(page);
        await expect(
          column(page, "needsyou").locator(`[data-run-id="${KANBAN_SSE_BP_RUN_ID}"]`)
        ).toBeVisible({ timeout: 15_000 });

        // Marker to prove no full page reload happens.
        await page.evaluate(() => {
          (window as unknown as Record<string, unknown>).__kanbanNoReload = true;
        });

        // Resolve the breakpoint on disk the way the approve action does.
        createdFiles = await resolveBreakpointOnDisk(KANBAN_SSE_BP_RUN_ID, KANBAN_SSE_BP_EFFECT_ID);

        // Within 10s the card leaves Needs you and appears in Working or Completed.
        await expect(
          column(page, "needsyou").locator(`[data-run-id="${KANBAN_SSE_BP_RUN_ID}"]`)
        ).toHaveCount(0, { timeout: 10_000 });
        const movedTo = column(page, "waiting")
          .locator(`[data-run-id="${KANBAN_SSE_BP_RUN_ID}"]`)
          .or(column(page, "completed").locator(`[data-run-id="${KANBAN_SSE_BP_RUN_ID}"]`));
        await expect(movedTo).toBeVisible({ timeout: 10_000 });

        // No reload happened (SSE-triggered refetch only).
        const marker = await page.evaluate(
          () => (window as unknown as Record<string, unknown>).__kanbanNoReload
        );
        expect(marker).toBe(true);
      } finally {
        for (const f of createdFiles) await fs.unlink(f).catch(() => {});
      }
    }
  );
});

// ---------------------------------------------------------------------------
// hiddenProjects, junk dirs, empty & overflow states
// ---------------------------------------------------------------------------

test.describe("Kanban board — hidden projects, junk, empty & overflow (SPEC-vibekanban)", () => {
  test(
    `AC-19: hidden-project breakpoints stay on the Needs-you alarm surface (marked), other hidden runs appear in no column, counts agree (${PENDING_IMPL})`,
    async ({ page }) => {
      // Fixture prerequisite: registry hiddenProjects includes
      // "kanban-hidden-project", which has HIDDEN_BP_RUN_ID (pending breakpoint)
      // and HIDDEN_PLAIN_RUN_ID (plain waiting run).
      await gotoBoard(page);

      // The hidden project's breakpoint run IS in Needs you, with the hidden marker.
      const bpCard = column(page, "needsyou").locator(`[data-run-id="${HIDDEN_BP_RUN_ID}"]`);
      await expect(bpCard).toBeVisible({ timeout: 15_000 });
      await expect(bpCard.locator('[title="project hidden from grid"]')).toBeVisible();

      // The hidden project's NON-breakpoint run appears in NO column.
      await expect(cardFor(page, HIDDEN_PLAIN_RUN_ID)).toHaveCount(0);

      // Invariant: Needs-you column count === needs-you pill count === banner item count.
      const columnN = await readCount(page, "needsyou");
      const pillText = (await page.getByTestId("filter-pill-needsyou").textContent()) ?? "";
      const pillN = parseInt(pillText.match(/\d+/)?.[0] ?? "-1", 10);
      const bannerN = await page
        .getByTestId("breakpoint-banner")
        .locator('a[href^="/runs/"]')
        .count();
      expect(pillN).toBe(columnN);
      expect(bannerN).toBe(columnN);

      // The "N hidden" indicator chip stays visible in board view.
      await expect(page.getByTestId("hidden-projects-indicator")).toBeVisible();
    }
  );

  test(
    `AC-20: junk directories (non-run dirs in a watched source) get no card in any column and are excluded from counts (${PENDING_IMPL})`,
    async ({ page }) => {
      // Self-contained junk fixture: a directory with no journal/ and no
      // run.json inside the watched fixture source.
      const junkName = "kanban-junk-dir-not-a-run";
      const junkDir = path.join(FIXTURES_RUNS_DIR, junkName);
      try {
        await fs.mkdir(junkDir, { recursive: true });
        await fs.writeFile(path.join(junkDir, "stray.txt"), "not a run\n");

        await gotoBoard(page);

        // No card anywhere references the junk dir.
        await expect(
          page.locator(`[data-testid="kanban-card"][data-run-id*="${junkName}"]`)
        ).toHaveCount(0);

        // Board counts exclude it: total card count across visible columns
        // equals the sum of the column header counts (no phantom entries).
        let headerSum = 0;
        for (const key of COLUMN_KEYS) {
          if ((await column(page, key).count()) === 0) continue;
          headerSum += await readCount(page, key);
        }
        const totalCards = await page.locator('[data-testid="kanban-card"]').count();
        expect(totalCards).toBeLessThanOrEqual(headerSum); // virtualization may render fewer
        expect(headerSum).toBe(manifest.runCount + 0 /* junk contributes nothing */);
      } finally {
        await fs.rm(junkDir, { recursive: true, force: true }).catch(() => {});
      }
    }
  );

  test(
    `AC-21: empty board renders the shared EmptyState; a populated board shows the per-column "all clear" placeholder in Needs you (${PENDING_IMPL})`,
    async ({ page }) => {
      // Zero runs at all => shared EmptyState, full width, no column skeletons.
      await interceptRuns(page, []);
      await page.goto("/", { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("empty-state")).toBeVisible({ timeout: 30_000 });
      await expect(page.locator('[data-testid="kanban-board"] .animate-pulse')).toHaveCount(0);
      await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);

      // Runs only in Working => Needs-you renders its quiet placeholder.
      await page.unroute("**/api/runs?*");
      await interceptRuns(page, [makeApiRun({ runId: "01KSYNTHONLYWORKING00001" })]);
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(board(page)).toBeVisible({ timeout: 30_000 });
      await expect(column(page, "needsyou")).toContainText("Nothing needs you — all clear.");
      expect(await readCount(page, "needsyou")).toBe(0);
      await expect(cardsIn(page, "waiting")).toHaveCount(1);
    }
  );

  test(
    `AC-22: a 40-run Completed column scrolls independently and virtualizes (fewer DOM cards than its header count of 40) (${PENDING_IMPL})`,
    async ({ page }) => {
      const runs = Array.from({ length: 40 }, (_, i) =>
        makeApiRun({
          runId: `01KSYNTHDONE${String(i).padStart(12, "0")}`,
          status: "completed",
          completedTasks: 4,
          updatedAt: new Date(Date.now() - i * 60_000).toISOString(),
        })
      );
      await interceptRuns(page, runs);
      await gotoBoard(page);

      // Header count is honest: 40.
      expect(await readCount(page, "completed")).toBe(40);

      // Virtualization active above threshold 15: fewer DOM cards than 40.
      const domCards = await cardsIn(page, "completed").count();
      expect(domCards).toBeGreaterThan(0);
      expect(domCards).toBeLessThan(40);

      // The column's card container scrolls independently (not the page body).
      const container = page.getByTestId("kanban-column-cards-completed");
      const { scrollHeight, clientHeight } = await container.evaluate((el) => ({
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight,
      }));
      expect(scrollHeight).toBeGreaterThan(clientHeight);
      const bodyOverflow = await page.evaluate(
        () => document.body.scrollHeight - window.innerHeight
      );
      // Scrolling 40 cards must not be delegated to the page body.
      expect(scrollHeight - clientHeight).toBeGreaterThan(bodyOverflow);
    }
  );
});

// ---------------------------------------------------------------------------
// Pill focus, keyboard & a11y
// ---------------------------------------------------------------------------

test.describe("Kanban board — pill focus & keyboard (SPEC-vibekanban)", () => {
  test(
    `AC-23: clicking the Failed pill focuses/highlights the Failed column and dims the others without switching to the flat list; All restores (${PENDING_IMPL})`,
    async ({ page }) => {
      await interceptRuns(page, [
        makeApiRun({ runId: "01KSYNTHWORKING000000001" }),
        makeApiRun({ runId: "01KSYNTHFAILED0000000002", status: "failed" }),
        makeApiRun({ runId: "01KSYNTHDONE000000000003", status: "completed", completedTasks: 4 }),
      ]);
      await gotoBoard(page);

      await page.getByTestId("filter-pill-failed").click();

      // Still the board — never the flat list.
      await expect(board(page)).toBeVisible();
      await expect(page.getByTestId("run-list-flat")).toHaveCount(0);

      // Failed column highlighted and in view; other columns dimmed.
      const failedCol = column(page, "failed");
      await expect(failedCol).toHaveAttribute("data-focused", "true");
      await expect(failedCol).toBeInViewport();
      await expect(column(page, "waiting")).toHaveAttribute("data-dimmed", "true");
      await expect(column(page, "completed")).toHaveAttribute("data-dimmed", "true");

      // "All" clears the focus.
      await page.getByTestId("filter-pill-all").click();
      await expect(failedCol).not.toHaveAttribute("data-focused", "true");
      await expect(column(page, "waiting")).not.toHaveAttribute("data-dimmed", "true");
    }
  );

  test(
    "AC-24: roving tabindex — ArrowDown moves within the column, ArrowRight jumps to the adjacent column, Enter opens the focused run",
    async ({ page }) => {
      await interceptRuns(page, [
        makeApiRun({ runId: "01KSYNTHBPA0000000000001", pendingBreakpoints: 1 }),
        makeApiRun({ runId: "01KSYNTHBPB0000000000002", pendingBreakpoints: 1 }),
        makeApiRun({ runId: "01KSYNTHORPHA00000000003", driver: "orphaned" }),
        makeApiRun({ runId: "01KSYNTHORPHB00000000004", driver: "orphaned" }),
      ]);
      await gotoBoard(page);

      const focusedRunId = () =>
        page.evaluate(() =>
          document.activeElement
            ?.closest('[data-testid="kanban-card"]')
            ?.getAttribute("data-run-id") ??
          document.activeElement?.getAttribute("data-run-id") ??
          null
        );

      // Focus the first Needs-you card.
      const first = cardsIn(page, "needsyou").first();
      await expect(first).toBeVisible();
      await first.focus();

      const needsyouIds = await cardsIn(page, "needsyou").evaluateAll((els) =>
        els.map((el) => el.getAttribute("data-run-id"))
      );
      expect(await focusedRunId()).toBe(needsyouIds[0]);

      // ArrowDown => next card in the same column.
      await page.keyboard.press("ArrowDown");
      expect(await focusedRunId()).toBe(needsyouIds[1]);

      // ArrowRight => same index in the adjacent column (Orphaned).
      await page.keyboard.press("ArrowRight");
      const orphanedIds = await cardsIn(page, "orphaned").evaluateAll((els) =>
        els.map((el) => el.getAttribute("data-run-id"))
      );
      const landedOn = await focusedRunId();
      expect(landedOn).toBe(orphanedIds[1]);

      // Enter => opens the focused card's run page.
      await page.keyboard.press("Enter");
      await page.waitForURL(`**/runs/${landedOn}`, { timeout: 15_000 });
    }
  );
});
