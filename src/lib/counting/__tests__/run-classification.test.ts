/**
 * SINGLE counting source — invariant tests (SPEC-vibekanban §15.6 AC-69..AC-77,
 * owner gate 2026-07-06b hidden model A). Proves that every pill reconciles
 * with its board column plus disclosed deltas:
 *
 *     pill(S) === column(S) + underNeedsYou(S) + fromHidden(S) + hiddenCollapsed(S)
 *
 * across fixture sets that include hidden projects, an overlapping
 * (orphaned === stale) set, absorbed needs-you runs, and a
 * recordedAwaitingResume run whose pendingBreakpoints has dropped to 0.
 */

import { describe, it, expect } from "vitest";
import type { Run } from "@/types";
import type { LightRun } from "@/lib/services/run-query-service";
import {
  classifyRun,
  computeReconciledCounts,
  metricsFromReconciled,
  type PillStatus,
} from "@/lib/counting/run-classification";

const RECENT = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

let seq = 0;
function makeRun(overrides: Partial<LightRun> = {}): LightRun {
  seq += 1;
  const base: Omit<Run, "events"> = {
    runId: `01RUN${String(seq).padStart(19, "0")}`,
    processId: "proc",
    status: "waiting",
    createdAt: RECENT,
    updatedAt: RECENT,
    tasks: [],
    totalTasks: 1,
    completedTasks: 0,
    failedTasks: 0,
    projectName: "visible",
  };
  return { ...base, events: [] as never[], totalEvents: 0, ...overrides } as LightRun;
}

const ALL_STATUSES: PillStatus[] = [
  "all",
  "waiting",
  "needsyou",
  "orphaned",
  "stale",
  "completed",
  "failed",
];

/** The invariant every reconciled count must satisfy, by construction. */
function assertInvariant(runs: LightRun[], hiddenProjects?: Set<string>) {
  const counts = computeReconciledCounts(runs, { hiddenProjects });
  for (const s of ALL_STATUSES) {
    const c = counts[s];
    expect(
      c.column + c.underNeedsYou + c.fromHidden + c.hiddenCollapsed,
      `pill(${s}) must equal column+underNeedsYou+fromHidden+hiddenCollapsed`
    ).toBe(c.pill);
  }
  return counts;
}

describe("classifyRun — single producer (AC-69)", () => {
  it("classifies recordedAwaitingResume (pendingBreakpoints=0) as needsYou for BOTH pill and column", () => {
    const run = makeRun({
      status: "waiting",
      pendingBreakpoints: 0,
      recordedAwaitingResume: true,
      driver: "none",
    });
    const c = classifyRun(run);
    expect(c.needsYou).toBe(true);
    expect(c.column).toBe("needsyou");
    const counts = computeReconciledCounts([run]);
    expect(counts.needsyou.pill).toBe(1);
  });

  it("a stale run with no lock is BOTH orphaned and stale (overlap), column=orphaned", () => {
    const run = makeRun({ status: "waiting", isStale: true, driver: "none" });
    const c = classifyRun(run);
    // Raw overlapping flags: orphaned wins precedence, so stale flag is false
    // here but the stale PILL predicate still counts it (isStale===true).
    expect(c.orphaned).toBe(true);
    expect(c.column).toBe("orphaned");
  });

  it("terminal runs are never needsYou/orphaned even with residual pendingBreakpoints", () => {
    const run = makeRun({ status: "completed", pendingBreakpoints: 2 });
    const c = classifyRun(run);
    expect(c.needsYou).toBe(false);
    expect(c.orphaned).toBe(false);
    expect(c.terminal).toBe(true);
    expect(c.column).toBe("completed");
  });
});

describe("computeReconciledCounts — the invariant holds by construction", () => {
  it("empty input yields all-zero counts satisfying the invariant", () => {
    const counts = assertInvariant([]);
    for (const s of ALL_STATUSES) expect(counts[s].pill).toBe(0);
  });

  it("overlapping orphaned===stale set: stale pill reconciles via underNeedsYou (AC-72/73)", () => {
    // 5 stale + no-lock runs (each is BOTH orphaned-pred and stale-pred).
    const stalledOrphans = Array.from({ length: 5 }, () =>
      makeRun({ status: "waiting", isStale: true, driver: "none" })
    );
    // 2 of them also carry a pending breakpoint → absorbed UP into Needs-you.
    stalledOrphans[0].pendingBreakpoints = 1;
    stalledOrphans[1].recordedAwaitingResume = true;

    const counts = assertInvariant(stalledOrphans);

    // orphaned pill = 5 (all match), 2 absorbed to needsyou, 3 render in Stalled.
    expect(counts.orphaned.pill).toBe(5);
    expect(counts.orphaned.underNeedsYou).toBe(2);
    expect(counts.orphaned.column).toBe(3);
    // stale pill = 5 (identical overlapping set), same 2 absorbed.
    expect(counts.stale.pill).toBe(5);
    expect(counts.stale.underNeedsYou).toBe(2);
    expect(counts.stale.column).toBe(3);
    // needs-you column = the 2 absorbed.
    expect(counts.needsyou.pill).toBe(2);
    expect(counts.needsyou.column).toBe(2);
  });

  it("hidden needs-you surfaces via fromHidden; hidden non-needsyou stays collapsed (AC-71/76)", () => {
    const hidden = new Set(["home"]);
    const runs = [
      // Visible needs-you.
      makeRun({ projectName: "visible", pendingBreakpoints: 1 }),
      // Hidden needs-you → surfaced (fromHidden).
      makeRun({ projectName: "home", pendingBreakpoints: 1 }),
      makeRun({ projectName: "home", recordedAwaitingResume: true, pendingBreakpoints: 0 }),
      // Hidden live working run → NOT surfaced in wave 1 (hiddenCollapsed for
      // needs-you scope it is not; it is simply out of the visible working pill).
      makeRun({ projectName: "home", status: "waiting", driver: "live" }),
      // Visible completed.
      makeRun({ projectName: "visible", status: "completed" }),
    ];

    const counts = assertInvariant(runs, hidden);

    // needs-you (all-scope): 1 visible + 2 hidden surfaced = 3, with 2 from hidden.
    expect(counts.needsyou.pill).toBe(3);
    expect(counts.needsyou.column).toBe(1);
    expect(counts.needsyou.fromHidden).toBe(2);
    // waiting (visible-scope): the hidden live run is excluded; the visible
    // needs-you run matches the non-stale-in-progress predicate but is absorbed
    // UP into Needs-you (column 0, underNeedsYou 1) — the workingOverflow case.
    expect(counts.waiting.pill).toBe(1);
    expect(counts.waiting.column).toBe(0);
    expect(counts.waiting.underNeedsYou).toBe(1);
    // total (visible-scope): visible needs-you + visible completed = 2.
    expect(counts.all.pill).toBe(2);
    // completed (visible-scope): 1.
    expect(counts.completed.pill).toBe(1);
  });

  it("tiles/banner metrics derive from the same reconciled source", () => {
    const runs = [
      makeRun({ status: "completed" }),
      makeRun({ status: "completed" }),
      makeRun({ status: "failed" }),
      makeRun({ status: "waiting", isStale: true, driver: "none" }),
      makeRun({ status: "waiting", pendingBreakpoints: 1 }),
    ];
    const counts = assertInvariant(runs);
    const m = metricsFromReconciled(counts);
    expect(m.completedRuns).toBe(counts.completed.pill);
    expect(m.failedRuns).toBe(counts.failed.pill);
    expect(m.staleRuns).toBe(counts.stale.pill);
    expect(m.pendingBreakpoints).toBe(counts.needsyou.pill);
    // Every tile equals its pill → tiles and pills cannot diverge.
    expect(m.totalRuns).toBe(counts.all.pill);
  });

  it("§15 live snapshot shape: needs-you pill === column (11), not the digest 6", () => {
    const hidden = new Set(["home", "DEPUTYsmartSAMAL", "ai-career-research"]);
    const runs: LightRun[] = [];
    // 6 pending-breakpoint needs-you runs: 1 visible + 5 hidden (matches §15.3).
    runs.push(makeRun({ projectName: "visible", pendingBreakpoints: 1 }));
    for (let i = 0; i < 3; i++)
      runs.push(makeRun({ projectName: "DEPUTYsmartSAMAL", pendingBreakpoints: 1 }));
    for (let i = 0; i < 2; i++)
      runs.push(makeRun({ projectName: "ai-career-research", pendingBreakpoints: 1 }));
    // 5 recordedAwaitingResume runs (pendingBreakpoints already 0): the +5 the
    // digest pill could not see (§15.3 GAP-1). 3 visible + 2 hidden.
    for (let i = 0; i < 3; i++)
      runs.push(
        makeRun({ projectName: "visible", recordedAwaitingResume: true, pendingBreakpoints: 0 })
      );
    for (let i = 0; i < 2; i++)
      runs.push(
        makeRun({ projectName: "home", recordedAwaitingResume: true, pendingBreakpoints: 0 })
      );

    const counts = assertInvariant(runs, hidden);
    // Full-run predicate: 6 pendingBp + 5 recorded = 11, pill === column-total.
    expect(counts.needsyou.pill).toBe(11);
    // 7 of the 11 are hidden (5 hidden pendingBp + 2 hidden recorded).
    expect(counts.needsyou.fromHidden).toBe(7);
    // 4 visible surface in the needs-you column.
    expect(counts.needsyou.column).toBe(4);
  });
});
