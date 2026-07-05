/**
 * Kanban board column model — SPEC-vibekanban §3 (pure logic, Wave 1).
 *
 * Columns derive 1:1 from the bucket predicates already implemented in
 * `filterByStatus` (src/lib/services/run-query-service.ts) and mirrored by the
 * RunFilterBar pills. This module introduces NO new predicate logic — only a
 * PRECEDENCE that turns the overlapping filter buckets into a disjoint
 * partition (a card lives in exactly one column).
 *
 * Contract (LAW): observer-only · read-only. This is a pure presentation
 * mapping over runs the observer already fetched; it never writes anything.
 */

import type { LightRun } from "@/lib/services/run-query-service";

/** Column keys, matching the RunFilterBar pill/bucket keys (SPEC §3.2). */
export type BoardColumnKey =
  | "needsyou"
  | "orphaned"
  | "waiting"
  | "stale"
  | "failed"
  | "completed";

/**
 * Column visual order = SPEC §3.2 table order = the flat-list rank() order in
 * run-list.tsx (needs-you → orphaned → waiting → stale), extended with the two
 * terminal columns.
 */
export const COLUMN_ORDER: BoardColumnKey[] = [
  "needsyou",
  "orphaned",
  "waiting",
  "stale",
  "failed",
  "completed",
];

/**
 * A run as it appears on the board: hidden-project breakpoint runs retained in
 * Needs-you carry `hiddenProject: true` so the card can show the EyeOff marker
 * (SPEC §6.3 / QA F4 — needs-you is never silently swallowed).
 */
export type BoardRun = LightRun & { hiddenProject?: boolean };

export type BoardPartition = Record<BoardColumnKey, BoardRun[]>;

/** Non-terminal = still in progress (same guard as filterByStatus / run-list). */
function isNonTerminal(run: LightRun): boolean {
  return run.status === "waiting" || run.status === "pending";
}

/**
 * Canonical "needs you" predicate, verbatim from filterByStatus:
 * NON-terminal AND pendingBreakpoints > 0, falling back to the
 * waiting-at-a-breakpoint heuristic only for older cached run shapes that
 * predate pendingBreakpoints. DC-4: the non-terminal guard keeps terminal runs
 * with residual pendingBreakpoints from leaking in.
 */
function isNeedsYou(run: LightRun): boolean {
  if (!isNonTerminal(run)) return false;
  if (run.pendingBreakpoints !== undefined) return run.pendingBreakpoints > 0;
  return run.waitingKind === "breakpoint";
}

/**
 * Canonical "orphaned" predicate, verbatim from filterByStatus: a NON-terminal
 * run with no live driver — run.lock pid dead ("orphaned") OR no lock at all
 * ("none"). DC-3: both drivers map to Orphaned. Liveness is only meaningful
 * for in-progress runs, so terminal runs are never "orphaned".
 */
function isOrphanedBucket(run: LightRun): boolean {
  return (
    isNonTerminal(run) && (run.driver === "orphaned" || run.driver === "none")
  );
}

/**
 * Assign a run to exactly one column: first match in SPEC §3.2 precedence
 * order 1→6. Total (never throws, never "unassigned"): non-terminal runs are
 * caught by rows 1–4 (a non-terminal, non-stale run always matches row 3);
 * terminal runs by rows 4–6 (stale flag wins over failed/completed, matching
 * runSortPriority and the flat-list rank(), which test isStale first).
 */
export function assignColumn(run: LightRun): BoardColumnKey {
  // Row 1 — Needs you (highest precedence: the breakpoint is what the human
  // must know, even when the run is also orphaned and/or stale).
  if (isNeedsYou(run)) return "needsyou";
  // Row 2 — Orphaned (beats stale: matches rank() which puts orphaned above stale).
  if (isOrphanedBucket(run)) return "orphaned";
  // Row 3 — Working: non-terminal and NOT stale (same exclusion as the
  // "waiting" pill/badge — stale runs never render as Working).
  if (isNonTerminal(run) && run.isStale !== true) return "waiting";
  // Row 4 — Stale (verbatim pill predicate: r.isStale === true).
  if (run.isStale === true) return "stale";
  // Rows 5–6 — terminal.
  if (run.status === "failed") return "failed";
  return "completed";
}

/**
 * Within-column sort: updatedAt DESC with runId as the final tiebreaker — the
 * exact "activity" comparator from sortRuns (run-query-service.ts). Duplicated
 * here (not imported) because this module is bundled CLIENT-side: importing a
 * value from run-query-service drags its fs/config-loader server imports into
 * the client bundle and breaks the Next.js build. Type-only imports are fine.
 */
function sortByActivity(runs: LightRun[]): void {
  runs.sort((a, b) => {
    const cmp = (b.updatedAt || "").localeCompare(a.updatedAt || "");
    if (cmp !== 0) return cmp;
    return a.runId.localeCompare(b.runId);
  });
}

/** Build an empty partition with every column present (stable shape). */
function emptyPartition(): BoardPartition {
  return {
    needsyou: [],
    orphaned: [],
    waiting: [],
    stale: [],
    failed: [],
    completed: [],
  };
}

/**
 * Partition runs into disjoint columns (SPEC §3.3) and sort within each column
 * by updatedAt DESC with runId as final tiebreaker — the same determinism rule
 * as sortRuns "activity" mode (no visual jumping during the "morning chaos"
 * scenario), which is reused directly.
 *
 * hiddenProjects (SPEC §6.3 / QA F4): runs from registry-hidden projects are
 * excluded from every column EXCEPT Needs-you (alarm-surface parity with
 * allBreakpointRuns), where they are retained and flagged `hiddenProject: true`.
 */
export function partitionRuns(
  runs: LightRun[],
  hiddenProjects?: Set<string>
): BoardPartition {
  const partition = emptyPartition();

  for (const run of runs) {
    const column = assignColumn(run);
    const hidden = hiddenProjects?.has(run.projectName ?? "") === true;
    if (hidden) {
      // Needs-you is NEVER silently swallowed by hiddenProjects; everything
      // else follows grid parity and is excluded from the board.
      if (column !== "needsyou") continue;
      partition.needsyou.push({ ...run, hiddenProject: true });
      continue;
    }
    partition[column].push(run);
  }

  // Within-column order: updatedAt DESC, runId tiebreaker (sortRuns "activity").
  for (const key of COLUMN_ORDER) {
    sortByActivity(partition[key]);
  }

  return partition;
}

// ---------------------------------------------------------------------------
// UX-R2 §13.2 option (b) — display-level 4-column grouping (owner gate
// 2026-07-05 run 01KWRR8XAHFCDEGCRBRFHFF44W: 4-column taxonomy + color map).
// The six-bucket partition above is UNCHANGED (AC-1..AC-10 stand verbatim);
// groupColumns() is a pure display layer over it.
// ---------------------------------------------------------------------------

/** The four display columns the board renders (§13.2b order). */
export type BoardGroupKey = "needsyou" | "waiting" | "stalled" | "done";

/** Display order per §13.6 amended AC-12: Needs you → Working → Stalled → Done. */
export const GROUP_ORDER: BoardGroupKey[] = [
  "needsyou",
  "waiting",
  "stalled",
  "done",
];

/**
 * Bucket → host display column (§13.2b): orphaned+stale host under Stalled,
 * failed+completed under Done. Used by the pill→column focus mapping — the
 * filter pills keep all six buckets.
 */
export const GROUP_HOST: Record<BoardColumnKey, BoardGroupKey> = {
  needsyou: "needsyou",
  orphaned: "stalled",
  waiting: "waiting",
  stale: "stalled",
  failed: "done",
  completed: "done",
};

export type BoardGroups = Record<BoardGroupKey, BoardRun[]>;

/**
 * Group the six-bucket partition into the four display columns (AC-35).
 * Totals are preserved (Σ grouped sizes === Σ partition sizes) and the
 * within-group order is the concatenation in §3.2 precedence order — orphaned
 * cards before stale cards inside Stalled, failed before completed inside
 * Done — with each segment keeping its own updatedAt DESC order.
 */
export function groupColumns(partition: BoardPartition): BoardGroups {
  return {
    needsyou: partition.needsyou,
    waiting: partition.waiting,
    stalled: [...partition.orphaned, ...partition.stale],
    done: [...partition.failed, ...partition.completed],
  };
}

/**
 * Count honesty for the Stalled column header (SPEC §3.4, F1 lesson — AC-10
 * text amended per §13.6): pills count OVERLAPPING buckets while columns
 * count a DISJOINT partition, so orphaned/stale breakpoint runs render under
 * Needs-you and the orphaned/stale pill counts may exceed the Stalled column
 * count. Union math: a Needs-you run that is both orphaned AND stale counts
 * once. Absorption BETWEEN the orphaned and stale buckets stays inside the
 * Stalled host and is no longer a column-level discrepancy.
 *
 * Returns null when no needs-you run also matches a stalled-bucket predicate
 * (i.e. pill counts === column count).
 */
export function stalledOverflowTooltip(
  partition: Record<BoardColumnKey, LightRun[]>
): string | null {
  const wouldBeStalled = (run: LightRun) =>
    isOrphanedBucket(run) || run.isStale === true;
  const captured = partition.needsyou.filter(wouldBeStalled).length;
  if (captured === 0) return null;
  const noun = captured === 1 ? "run is" : "runs are";
  return `+${captured} more stalled ${noun} shown under Needs you`;
}
