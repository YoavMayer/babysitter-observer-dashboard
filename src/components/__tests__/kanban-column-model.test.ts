/**
 * FROZEN acceptance tests — SPEC-vibekanban §10, column mapping (AC-1..AC-10).
 *
 * Authored BEFORE any board implementation exists (pending-impl). This file
 * imports the SPEC-declared module path `src/components/kanban/column-model`
 * (SPEC §3.3 / §9). Until Wave 1 lands that module, this file fails to load
 * with a module-resolution error — that is the expected "frozen definition
 * of done" state. Do NOT weaken these assertions to make them pass; implement
 * the module instead.
 *
 * NOTE on file location: the SPEC plans `src/components/kanban/__tests__/`,
 * but the pre-implementation gate requires `src/components/kanban/` to stay
 * absent until implementation starts, so this file temporarily lives one
 * level up. It may be moved into `src/components/kanban/__tests__/` verbatim
 * once the module exists.
 *
 * Contract under test (SPEC §3.3):
 *   export const COLUMN_ORDER: BoardColumnKey[];
 *   export function assignColumn(run: LightRun): BoardColumnKey;
 *   export function partitionRuns(
 *     runs: LightRun[],
 *     hiddenProjects?: Set<string>,   // AC-9 "hidden-set argument"
 *   ): Record<BoardColumnKey, (LightRun & { hiddenProject?: boolean })[]>;
 *   // AC-10 (SPEC §3.4 overflow tooltip calc — export name fixed by this test):
 *   export function orphanedOverflowTooltip(
 *     partition: Record<BoardColumnKey, LightRun[]>,
 *   ): string | null;
 */

import { describe, it, expect } from "vitest";
import type { Run } from "@/types";
import type { LightRun } from "@/lib/services/run-query-service";
// pending-impl: SPEC-declared module path — does not exist until Wave 1.
import {
  COLUMN_ORDER,
  assignColumn,
  partitionRuns,
  orphanedOverflowTooltip,
  type BoardColumnKey,
} from "@/components/kanban/column-model";

// ---------------------------------------------------------------------------
// Helpers (mirroring run-query-service.test.ts conventions)
// ---------------------------------------------------------------------------

const RECENT_DATE = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();

function makeLightRun(overrides: Partial<LightRun> = {}): LightRun {
  const base: Omit<Run, "events"> = {
    runId: "01KTESTCOLMODEL000000001",
    processId: "data-pipeline",
    status: "waiting",
    createdAt: RECENT_DATE,
    updatedAt: RECENT_DATE,
    tasks: [],
    totalTasks: 3,
    completedTasks: 1,
    failedTasks: 0,
    projectName: "my-project",
  };
  return {
    ...base,
    events: [] as never[],
    totalEvents: 5,
    ...overrides,
  } as LightRun;
}

const EXPECTED_ORDER: BoardColumnKey[] = [
  "needsyou",
  "orphaned",
  "waiting",
  "stale",
  "failed",
  "completed",
];

describe("column-model (SPEC-vibekanban §3 / §10)", () => {
  it("COLUMN_ORDER matches SPEC §3.2 table order (precondition for AC-6/AC-12)", () => {
    expect(COLUMN_ORDER).toEqual(EXPECTED_ORDER);
  });

  // -------------------------------------------------------------------------
  // AC-1
  // -------------------------------------------------------------------------
  it("AC-1: assignColumn returns needsyou for status:waiting + pendingBreakpoints:2 regardless of driver or isStale", () => {
    const drivers: LightRun["driver"][] = ["live", "orphaned", "none", undefined];
    const staleValues: (boolean | undefined)[] = [true, false, undefined];
    for (const driver of drivers) {
      for (const isStale of staleValues) {
        const run = makeLightRun({
          status: "waiting",
          pendingBreakpoints: 2,
          driver,
          isStale,
        });
        expect(assignColumn(run), `driver=${driver} isStale=${isStale}`).toBe("needsyou");
      }
    }
  });

  // -------------------------------------------------------------------------
  // AC-2
  // -------------------------------------------------------------------------
  it("AC-2: assignColumn returns needsyou via legacy fallback (pendingBreakpoints undefined, waitingKind breakpoint, non-terminal)", () => {
    for (const status of ["waiting", "pending"] as const) {
      const run = makeLightRun({
        status,
        pendingBreakpoints: undefined,
        waitingKind: "breakpoint",
        driver: "live",
        isStale: false,
      });
      expect(assignColumn(run), `status=${status}`).toBe("needsyou");
    }
  });

  // -------------------------------------------------------------------------
  // AC-3
  // -------------------------------------------------------------------------
  it('AC-3: assignColumn returns orphaned for non-terminal run with driver "none" (and "orphaned") and pendingBreakpoints 0 — DC-3', () => {
    for (const driver of ["none", "orphaned"] as const) {
      const run = makeLightRun({
        status: "waiting",
        driver,
        pendingBreakpoints: 0,
        isStale: false,
      });
      expect(assignColumn(run), `driver=${driver}`).toBe("orphaned");
    }
  });

  // -------------------------------------------------------------------------
  // AC-4
  // -------------------------------------------------------------------------
  it('AC-4: assignColumn returns completed (never orphaned) for a completed run with driver "none"', () => {
    const run = makeLightRun({
      status: "completed",
      driver: "none",
      completedTasks: 3,
    });
    expect(assignColumn(run)).toBe("completed");
  });

  it("AC-4: assignColumn returns completed (never needsyou) for a completed run with residual pendingBreakpoints > 0 — DC-4 non-terminal guard", () => {
    const run = makeLightRun({
      status: "completed",
      pendingBreakpoints: 3,
      completedTasks: 3,
    });
    expect(assignColumn(run)).toBe("completed");
  });

  // -------------------------------------------------------------------------
  // AC-5
  // -------------------------------------------------------------------------
  it("AC-5: assignColumn returns stale for a non-terminal, non-breakpoint, live-driver run with isStale:true — and waiting when isStale:false", () => {
    const base = {
      status: "waiting" as const,
      pendingBreakpoints: 0,
      driver: "live" as const,
    };
    expect(assignColumn(makeLightRun({ ...base, isStale: true }))).toBe("stale");
    expect(assignColumn(makeLightRun({ ...base, isStale: false }))).toBe("waiting");
  });

  // -------------------------------------------------------------------------
  // AC-6
  // -------------------------------------------------------------------------
  it("AC-6: precedence — breakpoint + orphaned + stale maps to needsyou; orphaned + stale (no breakpoint) maps to orphaned", () => {
    const tripleOverlap = makeLightRun({
      status: "waiting",
      pendingBreakpoints: 1,
      driver: "orphaned",
      isStale: true,
    });
    expect(assignColumn(tripleOverlap)).toBe("needsyou");

    const orphanedStale = makeLightRun({
      status: "waiting",
      pendingBreakpoints: 0,
      driver: "orphaned",
      isStale: true,
    });
    expect(assignColumn(orphanedStale)).toBe("orphaned");
  });

  // -------------------------------------------------------------------------
  // AC-7
  // -------------------------------------------------------------------------
  it("AC-7: totality + disjointness over the full status × isStale × driver × pendingBreakpoints × waitingKind matrix", () => {
    const statuses: Run["status"][] = ["pending", "waiting", "completed", "failed"];
    const staleValues: (boolean | undefined)[] = [true, false, undefined];
    const drivers: LightRun["driver"][] = ["live", "orphaned", "none", undefined];
    const pendingValues: (number | undefined)[] = [undefined, 0, 2];
    const waitingKinds: LightRun["waitingKind"][] = [undefined, "breakpoint", "task"];

    const matrix: LightRun[] = [];
    let i = 0;
    for (const status of statuses)
      for (const isStale of staleValues)
        for (const driver of drivers)
          for (const pendingBreakpoints of pendingValues)
            for (const waitingKind of waitingKinds) {
              matrix.push(
                makeLightRun({
                  runId: `01KTESTMATRIX${String(i++).padStart(11, "0")}`,
                  status,
                  isStale,
                  driver,
                  pendingBreakpoints,
                  waitingKind,
                })
              );
            }
    expect(matrix.length).toBe(4 * 3 * 4 * 3 * 3);

    // Totality: assignColumn never throws and always returns a known column.
    for (const run of matrix) {
      const col = assignColumn(run);
      expect(COLUMN_ORDER, `run ${run.runId} got unknown column ${col}`).toContain(col);
    }

    // Disjointness: partitionRuns places every run in exactly one column.
    const partition = partitionRuns(matrix);
    const seen = new Map<string, BoardColumnKey[]>();
    let total = 0;
    for (const key of COLUMN_ORDER) {
      const bucket = partition[key];
      expect(Array.isArray(bucket), `partition missing column ${key}`).toBe(true);
      total += bucket.length;
      for (const run of bucket) {
        seen.set(run.runId, [...(seen.get(run.runId) ?? []), key]);
      }
    }
    expect(total).toBe(matrix.length);
    for (const run of matrix) {
      const columns = seen.get(run.runId) ?? [];
      expect(columns.length, `run ${run.runId} appears in ${columns.join(",")}`).toBe(1);
    }
  });

  // -------------------------------------------------------------------------
  // AC-8
  // -------------------------------------------------------------------------
  it("AC-8: within-column order is updatedAt DESC with runId tiebreaker, stable across repeated partitions", () => {
    const sameTs = new Date(Date.now() - 60_000).toISOString();
    const newerTs = new Date(Date.now() - 30_000).toISOString();
    const runB = makeLightRun({
      runId: "01KTESTTIEBREAKB00000002",
      status: "waiting",
      isStale: false,
      driver: "live",
      pendingBreakpoints: 0,
      updatedAt: sameTs,
    });
    const runA = makeLightRun({
      runId: "01KTESTTIEBREAKA00000001",
      status: "waiting",
      isStale: false,
      driver: "live",
      pendingBreakpoints: 0,
      updatedAt: sameTs,
    });
    const runNewer = makeLightRun({
      runId: "01KTESTTIEBREAKC00000003",
      status: "waiting",
      isStale: false,
      driver: "live",
      pendingBreakpoints: 0,
      updatedAt: newerTs,
    });

    // Feed in different input orders; output order must be identical:
    // newest first, then runId ascending among identical timestamps.
    const expectedIds = [runNewer.runId, runA.runId, runB.runId];
    const inputs = [
      [runB, runA, runNewer],
      [runNewer, runB, runA],
      [runA, runNewer, runB],
    ];
    for (const input of inputs) {
      const partition = partitionRuns(input);
      expect(partition.waiting.map((r) => r.runId)).toEqual(expectedIds);
    }
  });

  // -------------------------------------------------------------------------
  // AC-9
  // -------------------------------------------------------------------------
  it("AC-9: hiddenProjects rule — hidden runs excluded from all columns EXCEPT needsyou, where they are retained and flagged hiddenProject:true", () => {
    const hidden = new Set(["secret-project"]);
    const hiddenBreakpoint = makeLightRun({
      runId: "01KTESTHIDDENBP000000001",
      projectName: "secret-project",
      status: "waiting",
      pendingBreakpoints: 1,
      driver: "live",
      isStale: false,
    });
    const hiddenWorking = makeLightRun({
      runId: "01KTESTHIDDENWORK0000002",
      projectName: "secret-project",
      status: "waiting",
      pendingBreakpoints: 0,
      driver: "live",
      isStale: false,
    });
    const hiddenOrphaned = makeLightRun({
      runId: "01KTESTHIDDENORPH0000003",
      projectName: "secret-project",
      status: "pending",
      pendingBreakpoints: 0,
      driver: "none",
    });
    const hiddenStale = makeLightRun({
      runId: "01KTESTHIDDENSTALE000004",
      projectName: "secret-project",
      status: "waiting",
      pendingBreakpoints: 0,
      driver: "live",
      isStale: true,
    });
    const hiddenFailed = makeLightRun({
      runId: "01KTESTHIDDENFAIL0000005",
      projectName: "secret-project",
      status: "failed",
    });
    const hiddenCompleted = makeLightRun({
      runId: "01KTESTHIDDENDONE0000006",
      projectName: "secret-project",
      status: "completed",
    });
    const visibleWorking = makeLightRun({
      runId: "01KTESTVISIBLEWORK000007",
      projectName: "my-project",
      status: "waiting",
      pendingBreakpoints: 0,
      driver: "live",
      isStale: false,
    });

    const partition = partitionRuns(
      [
        hiddenBreakpoint,
        hiddenWorking,
        hiddenOrphaned,
        hiddenStale,
        hiddenFailed,
        hiddenCompleted,
        visibleWorking,
      ],
      hidden
    );

    // Needs-you retains the hidden-project breakpoint run, flagged.
    expect(partition.needsyou.map((r) => r.runId)).toEqual([hiddenBreakpoint.runId]);
    expect(partition.needsyou[0].hiddenProject).toBe(true);

    // Every other column excludes hidden-project runs.
    expect(partition.orphaned).toEqual([]);
    expect(partition.stale).toEqual([]);
    expect(partition.failed).toEqual([]);
    expect(partition.completed).toEqual([]);
    expect(partition.waiting.map((r) => r.runId)).toEqual([visibleWorking.runId]);

    // Visible runs are not flagged.
    expect(partition.waiting[0].hiddenProject).not.toBe(true);
  });

  // -------------------------------------------------------------------------
  // AC-10
  // -------------------------------------------------------------------------
  it('AC-10: overflow tooltip math — 2 orphaned-breakpoint runs + 1 pure orphaned run gives Orphaned count 1 with tooltip containing "2 more"', () => {
    const orphanedBp1 = makeLightRun({
      runId: "01KTESTORPHBP10000000001",
      status: "waiting",
      pendingBreakpoints: 1,
      driver: "orphaned",
    });
    const orphanedBp2 = makeLightRun({
      runId: "01KTESTORPHBP20000000002",
      status: "waiting",
      pendingBreakpoints: 1,
      driver: "none",
    });
    const pureOrphaned = makeLightRun({
      runId: "01KTESTORPHPURE000000003",
      status: "waiting",
      pendingBreakpoints: 0,
      driver: "orphaned",
    });

    const partition = partitionRuns([orphanedBp1, orphanedBp2, pureOrphaned]);

    // Disjoint partition: the two breakpoint runs live under Needs you.
    expect(partition.needsyou).toHaveLength(2);
    expect(partition.orphaned).toHaveLength(1);
    expect(partition.orphaned[0].runId).toBe(pureOrphaned.runId);

    // SPEC §3.4: '"+N more orphaned runs are shown under Needs you"'.
    const tooltip = orphanedOverflowTooltip(partition);
    expect(tooltip).toBeTruthy();
    expect(tooltip).toContain("2 more");
    expect(tooltip).toContain("Needs you");
  });

  it("AC-10 (complement): no tooltip when no orphaned runs are captured by Needs you", () => {
    const pureOrphaned = makeLightRun({
      runId: "01KTESTORPHONLY000000001",
      status: "waiting",
      pendingBreakpoints: 0,
      driver: "orphaned",
    });
    const liveBp = makeLightRun({
      runId: "01KTESTLIVEBP00000000002",
      status: "waiting",
      pendingBreakpoints: 1,
      driver: "live",
    });
    const partition = partitionRuns([pureOrphaned, liveBp]);
    expect(orphanedOverflowTooltip(partition)).toBeNull();
  });
});
