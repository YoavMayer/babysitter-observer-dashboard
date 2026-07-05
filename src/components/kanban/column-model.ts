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

/**
 * Count honesty for the Orphaned column header (SPEC §3.4, F1 lesson): pills
 * count OVERLAPPING buckets while columns count a DISJOINT partition, so
 * orphaned breakpoint runs render under Needs-you and the orphaned pill count
 * may exceed the Orphaned column count. This computes the tooltip that makes
 * the difference explicit — no silent mismatch.
 *
 * Returns null when no needs-you run also matches the orphaned bucket
 * predicate (i.e. pill count === column count).
 */
export function orphanedOverflowTooltip(
  partition: Record<BoardColumnKey, LightRun[]>
): string | null {
  const capturedByNeedsYou = partition.needsyou.filter(isOrphanedBucket).length;
  if (capturedByNeedsYou === 0) return null;
  const noun = capturedByNeedsYou === 1 ? "run is" : "runs are";
  return `+${capturedByNeedsYou} more orphaned ${noun} shown under Needs you`;
}

/**
 * Count honesty for the STALE bucket (design-QA round 1, same §3.4 mechanism
 * as orphanedOverflowTooltip): the stale pill counts every `isStale === true`
 * run, but Needs-you/Orphaned precedence absorbs stale runs into higher
 * columns — the board can even show NO Stale column (empty ⇒ auto-hidden)
 * while the pill still reads "Stale N". This computes the tooltip that makes
 * the absorption explicit — no silent mismatch.
 *
 * Returns null when no stale run was captured by a higher-precedence column
 * (i.e. pill count === Stale column count).
 */
export function staleOverflowTooltip(
  partition: Record<BoardColumnKey, LightRun[]>
): string | null {
  const isStale = (run: LightRun) => run.isStale === true;
  const capturedByNeedsYou = partition.needsyou.filter(isStale).length;
  const capturedByOrphaned = partition.orphaned.filter(isStale).length;
  const captured = capturedByNeedsYou + capturedByOrphaned;
  if (captured === 0) return null;
  const hosts = [
    capturedByNeedsYou > 0 ? "Needs you" : null,
    capturedByOrphaned > 0 ? "Orphaned" : null,
  ]
    .filter(Boolean)
    .join(" and ");
  const noun = captured === 1 ? "run is" : "runs are";
  return `+${captured} more stale ${noun} shown under ${hosts}`;
}
