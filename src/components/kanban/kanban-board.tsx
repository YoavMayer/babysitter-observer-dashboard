"use client";
import { useSmartPolling } from "@/hooks/use-smart-polling";
import { EmptyState } from "@/components/shared/empty-state";
import { KanbanColumn } from "@/components/kanban/kanban-column";
import {
  COLUMN_ORDER,
  partitionRuns,
  orphanedOverflowTooltip,
  type BoardColumnKey,
} from "@/components/kanban/column-model";
import type { RunsListResponse } from "@/lib/services/run-query-service";

/**
 * Kanban board view — SPEC-vibekanban §4 (data flow), §7 (empty/overflow).
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

/** Columns that auto-hide when empty, mirroring the pill behavior (§3.2). */
const AUTO_HIDE_WHEN_EMPTY: ReadonlySet<BoardColumnKey> = new Set([
  "orphaned",
  "stale",
]);

export interface KanbanBoardProps {
  /** Registry-hidden project names (§6.3): excluded from every column except Needs-you. */
  hiddenProjects?: Set<string>;
  /** When true, suppress SSE-triggered refetches (catch-up mode, §4). */
  suppressSseRefetch?: boolean;
}

export function KanbanBoard({ hiddenProjects, suppressSseRefetch }: KanbanBoardProps) {
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

  const runs = data?.runs ?? [];

  if (runs.length === 0) {
    // Empty board (§7): the shared EmptyState full-width, same as list view.
    return (
      <div data-testid="empty-state">
        <EmptyState />
      </div>
    );
  }

  const partition = partitionRuns(runs, hiddenProjects);
  const orphanedTooltip = orphanedOverflowTooltip(partition);

  return (
    // §7 horizontal overflow: the board scrolls inside its own container on
    // narrow viewports — never the page body. §8: region + accessible name.
    <div
      data-testid="kanban-board"
      role="region"
      aria-label="Run board"
      className="flex gap-3 overflow-x-auto pb-2"
    >
      {COLUMN_ORDER.map((key) => {
        // §3.2 auto-hide: Orphaned/Stale columns leave the DOM when empty,
        // mirroring their filter-pill behavior.
        if (AUTO_HIDE_WHEN_EMPTY.has(key) && partition[key].length === 0) {
          return null;
        }
        return (
          <KanbanColumn
            key={key}
            columnKey={key}
            runs={partition[key]}
            countTooltip={key === "orphaned" ? orphanedTooltip : undefined}
          />
        );
      })}
    </div>
  );
}
