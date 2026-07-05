"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSmartPolling } from "@/hooks/use-smart-polling";
import { EmptyState } from "@/components/shared/empty-state";
import { KanbanColumn, COLUMN_SPECS } from "@/components/kanban/kanban-column";
import {
  useBoardKeyboard,
  type BoardColumnRuns,
} from "@/components/kanban/use-board-keyboard";
import {
  COLUMN_ORDER,
  partitionRuns,
  orphanedOverflowTooltip,
  type BoardColumnKey,
  type BoardPartition,
} from "@/components/kanban/column-model";
import type { RunsListResponse } from "@/lib/services/run-query-service";

/**
 * Kanban board view — SPEC-vibekanban §4 (data flow), §7 (empty/overflow),
 * §8 (keyboard navigation, live region).
 *
 * ONE query, client partition: fetches /api/runs once (all-runs mode) and
 * partitions client-side with partitionRuns — this guarantees the
 * disjointness invariant and keeps a single polling URL (never six
 * per-column fetches). Live updates reuse useSmartPolling with the same
 * sseFilter as RunList (SSE-triggered refetch; no new stream endpoints).
 *
 * Read-only presentation of run state (contract LAW): this component fetches
 * with GET only and never mutates anything.
 */

/** §4: single all-runs query — status="", sort=status, limit=500, offset=0. */
const BOARD_FETCH_LIMIT = 500;

/** §8: column-count announcements are debounced to avoid SSE chatter. */
const LIVE_REGION_DEBOUNCE_MS = 5_000;

/** Columns that auto-hide when empty, mirroring the pill behavior (§3.2). */
const AUTO_HIDE_WHEN_EMPTY: ReadonlySet<BoardColumnKey> = new Set([
  "orphaned",
  "stale",
]);

/** The visible columns for a partition: COLUMN_ORDER minus auto-hidden ones. */
function visibleColumnKeys(partition: BoardPartition): BoardColumnKey[] {
  return COLUMN_ORDER.filter(
    (key) => !(AUTO_HIDE_WHEN_EMPTY.has(key) && partition[key].length === 0)
  );
}

/**
 * §8 polite live region: announce column-count changes ("Needs you: 3 runs"),
 * debounced ≥5s so SSE chatter never floods AT. The breakpoint banner keeps
 * its existing assertive alert role — this is deliberately the board's ONLY
 * live region, and it is polite.
 */
function useColumnCountAnnouncement(partition: BoardPartition): string {
  const [announcement, setAnnouncement] = useState("");
  const lastCountsRef = useRef<Record<BoardColumnKey, number> | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<string>("");

  const counts = useMemo(() => {
    const next = {} as Record<BoardColumnKey, number>;
    for (const key of COLUMN_ORDER) next[key] = partition[key].length;
    return next;
  }, [partition]);

  useEffect(() => {
    const last = lastCountsRef.current;
    if (last === null) {
      // First data: establish the baseline silently — the initial render is
      // not a "change" worth interrupting the screen reader for.
      lastCountsRef.current = counts;
      return;
    }
    const changed = COLUMN_ORDER.filter((key) => counts[key] !== last[key]);
    lastCountsRef.current = counts;
    if (changed.length === 0) return;

    pendingRef.current = changed
      .map((key) => {
        const n = counts[key];
        return `${COLUMN_SPECS[key].label}: ${n} run${n === 1 ? "" : "s"}`;
      })
      .join(". ");

    // Debounce: at most one announcement per window; later changes within the
    // window collapse into the latest pending message.
    if (timerRef.current) return;
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      setAnnouncement(pendingRef.current);
    }, LIVE_REGION_DEBOUNCE_MS);
  }, [counts]);

  // Clear any pending timer on unmount.
  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    []
  );

  return announcement;
}

export interface KanbanBoardProps {
  /** Registry-hidden project names (§6.3): excluded from every column except Needs-you. */
  hiddenProjects?: Set<string>;
  /** When true, suppress SSE-triggered refetches (catch-up mode, §4). */
  suppressSseRefetch?: boolean;
  /**
   * §6.2 pill → column focus: the focused column gets a highlight ring and is
   * scrolled into view; the others dim. null/undefined = no focus ("All").
   */
  focusColumnKey?: BoardColumnKey | null;
  /**
   * §7 fetch-window tails: invoked by a column's "View all in list →" row to
   * switch to list view with that column's status filter pre-applied.
   */
  onViewAllInList?: (key: BoardColumnKey) => void;
}

export function KanbanBoard({
  hiddenProjects,
  suppressSseRefetch,
  focusColumnKey = null,
  onViewAllInList,
}: KanbanBoardProps) {
  const params = new URLSearchParams({
    status: "",
    sort: "status",
    limit: String(BOARD_FETCH_LIMIT),
    offset: "0",
    search: "",
  });
  const url = `/api/runs?${params.toString()}`;

  // Same sseFilter as RunList: refetch on run updates and new runs (§4).
  const sseFilter = (event: { type: string }) =>
    event.type === "update" || event.type === "new-run";
  const { data, loading, error } = useSmartPolling<RunsListResponse>(url, {
    sseFilter,
    suppressSseRefetch,
  });

  const runs = useMemo(() => data?.runs ?? [], [data]);
  const partition = useMemo(
    () => partitionRuns(runs, hiddenProjects),
    [runs, hiddenProjects]
  );
  const visibleKeys = useMemo(() => visibleColumnKeys(partition), [partition]);

  // §8 roving tabindex: the keyboard hook navigates the VISIBLE columns in
  // rendered order (auto-hidden columns are skipped, matching the DOM).
  const keyboardColumns = useMemo<BoardColumnRuns[]>(
    () =>
      visibleKeys.map((key) => ({
        key,
        runIds: partition[key].map((run) => run.runId),
      })),
    [visibleKeys, partition]
  );
  const keyboard = useBoardKeyboard(keyboardColumns);

  // §8 polite live region (debounced column-count announcements).
  const announcement = useColumnCountAnnouncement(partition);

  if (loading && !data) {
    return (
      // Loading: per-column skeleton cards (pattern from RunList).
      // a11y-loading-not-announced: expose the fetching state to AT.
      // Deliberately NOT the kanban-board testid: the frozen e2e contract
      // treats a visible board as fully-rendered columns, never skeletons.
      <div
        className="flex gap-3"
        data-testid="kanban-board-loading"
        aria-busy="true"
      >
        <span role="status" className="sr-only">
          Loading runs
        </span>
        {[1, 2, 3, 4].map((col) => (
          <div key={col} className="flex flex-col gap-2 min-w-[280px] w-[280px]">
            {[1, 2, 3].map((card) => (
              <div
                key={card}
                className="h-20 rounded-md border border-border bg-card animate-pulse"
              />
            ))}
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      // Error: reuse the run-list-error treatment full-width (§7 — board hidden).
      <div
        data-testid="kanban-board-error"
        className="rounded-lg border border-error/20 bg-error-muted p-4 text-sm text-error"
      >
        Failed to load runs: {error}
      </div>
    );
  }

  if (runs.length === 0) {
    // Empty board (§7): the shared EmptyState full-width, same as list view.
    return (
      <div data-testid="empty-state">
        <EmptyState />
      </div>
    );
  }

  const orphanedTooltip = orphanedOverflowTooltip(partition);

  // §7 fetch-window: the API window is capped at 500 — when more runs exist,
  // say so instead of silently truncating (count-honesty, F1 lesson).
  const totalCount = data?.totalCount ?? runs.length;
  const fetchWindowTruncated = totalCount > BOARD_FETCH_LIMIT;

  return (
    <div>
      {/* §8: ONE polite live region at board level for column-count changes
          (debounced ≥5s). Never assertive — the breakpoint banner owns alarm. */}
      <div
        data-testid="kanban-live-region"
        aria-live="polite"
        className="sr-only"
      >
        {announcement}
      </div>

      {/* §7 fetch-window notice: board-level, under the filter bar. */}
      {fetchWindowTruncated && (
        <p
          data-testid="kanban-fetch-window-notice"
          className="mb-2 rounded-md border border-border bg-background-secondary px-3 py-1.5 text-xs text-foreground-muted"
        >
          Showing the {BOARD_FETCH_LIMIT} most relevant runs — open List view
          for everything
        </p>
      )}

      {/* §7 horizontal overflow: the board scrolls inside its own container on
          narrow viewports — never the page body. §8: region + accessible name. */}
      <div
        data-testid="kanban-board"
        role="region"
        aria-label="Run board"
        className="flex gap-3 overflow-x-auto pb-2"
      >
        {/* §3.2 auto-hide: Orphaned/Stale columns leave the DOM when empty,
            mirroring their filter-pill behavior (visibleColumnKeys). */}
        {visibleKeys.map((key) => (
          <KanbanColumn
            key={key}
            columnKey={key}
            runs={partition[key]}
            countTooltip={key === "orphaned" ? orphanedTooltip : undefined}
            focused={focusColumnKey === key}
            dimmed={focusColumnKey !== null && focusColumnKey !== key}
            keyboard={keyboard}
            onViewAllInList={
              // §7: with a truncated fetch window every column may be missing
              // runs — each gets the "View all in list →" tail.
              fetchWindowTruncated && onViewAllInList
                ? () => onViewAllInList(key)
                : undefined
            }
          />
        ))}
      </div>
    </div>
  );
}
