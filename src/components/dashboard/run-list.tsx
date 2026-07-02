"use client";
import { useState } from "react";
import Link from "next/link";
import { Wifi, AlertTriangle, Terminal, Copy, Tag } from "lucide-react";
import { cn } from "@/lib/cn";
import { friendlyProcessName, formatRelativeTime } from "@/lib/utils";
import { useSmartPolling } from "@/hooks/use-smart-polling";
import { EmptyState } from "@/components/shared/empty-state";
import type { DashboardStatusFilter } from "@/hooks/use-run-dashboard";
import type { LightRun, RunsListResponse } from "@/lib/services/run-query-service";

const PAGE_SIZE = 50;

/**
 * Whether a run is still in progress. Liveness ("live"/"orphaned") and the
 * resume/answer action hint are only meaningful for these runs — a terminal
 * run (completed/failed) has no attached orchestrator by definition.
 */
function isNonTerminal(run: LightRun): boolean {
  return run.status === "waiting" || run.status === "pending";
}

/** Whether a run is paused at a breakpoint waiting for a human decision. */
function isBreakpoint(run: LightRun): boolean {
  return isNonTerminal(run) && run.waitingKind === "breakpoint";
}

/** Whether a run has no live orchestrator attached. */
function isOrphaned(run: LightRun): boolean {
  return run.driver === "orphaned" || run.driver === "none";
}

/**
 * Client-side ordering (spec): needs-you → orphaned → waiting → stale → rest.
 * The server already sorts by status priority; this refines the head of the
 * list to the spec order for the flat filtered view.
 */
function rank(run: LightRun): number {
  if (isBreakpoint(run)) return 0;
  if (run.driver === "orphaned") return 1;
  if (run.status === "waiting" || run.status === "pending") return 2;
  if (run.isStale) return 3;
  return 4;
}

/** Inline driver-liveness chip derived from run.driver. */
function LivenessChip({ run }: { run: LightRun }) {
  if (!run.driver) return null;
  if (run.driver === "live") {
    return (
      <span
        className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold bg-success/10 text-success"
        title="A live orchestrator is attached to this run"
      >
        <Wifi className="h-3 w-3" /> live
      </span>
    );
  }
  return (
    <span
      className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold bg-error/15 text-error"
      title="No live orchestrator is attached — resume the run to continue it"
    >
      <AlertTriangle className="h-3 w-3" /> orphaned
    </span>
  );
}

/**
 * Neutral status indicator for terminal runs (completed/failed). Liveness is
 * not meaningful here, so we never show the "orphaned" chip — just a subtle,
 * status-appropriate dot with the plain status label.
 */
function StatusDot({ run }: { run: LightRun }) {
  const failed = run.status === "failed";
  return (
    <span
      className={cn(
        "flex items-center gap-1.5 rounded px-1.5 py-0.5 text-[10px] font-semibold",
        failed ? "bg-error/10 text-error" : "bg-foreground-muted/10 text-foreground-muted"
      )}
      title={`Run ${run.status}`}
    >
      <span className={cn("h-2 w-2 rounded-full", failed ? "bg-error" : "bg-success")} />
      {run.status}
    </span>
  );
}

/** Read-only action hint mirroring the breakpoint banner copy. */
function ActionHint({ run }: { run: LightRun }) {
  const [copied, setCopied] = useState(false);
  const orphaned = isOrphaned(run);

  const copyRunId = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      navigator.clipboard?.writeText(run.runId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard may be unavailable (non-secure context) — non-fatal
    }
  };

  return (
    <div className="shrink-0 flex items-center gap-2" data-testid="run-action-hint">
      {orphaned ? (
        <span
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-error/15 text-error border border-error/30"
          title="No live orchestrator is attached — an answer won't be applied until the run is resumed (babysitter run:iterate)"
        >
          <AlertTriangle className="h-3.5 w-3.5" /> No live driver — resume to answer
        </span>
      ) : (
        <span
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-warning/15 text-warning border border-warning/30"
          title="Answer this in the terminal that is driving this run"
        >
          <Terminal className="h-3.5 w-3.5" /> Answer in terminal
        </span>
      )}
      <button
        onClick={copyRunId}
        className="flex items-center gap-1 text-[10px] text-foreground-muted hover:text-foreground transition-colors"
        title="Copy run id (resolve it with: babysitter run:iterate <run>)"
      >
        <Copy className="h-3 w-3" /> {copied ? "copied" : "copy run id"}
      </button>
    </div>
  );
}

/** A single flat run row. */
function RunRow({ run }: { run: LightRun }) {
  // Liveness only applies to in-progress runs; terminal runs get a neutral dot.
  const nonTerminal = isNonTerminal(run);
  return (
    <Link
      href={`/runs/${run.runId}`}
      data-testid="run-row"
      className={cn(
        "group flex items-center gap-3 px-3 py-2 rounded-md",
        "border border-border bg-card hover:bg-background-secondary transition-colors"
      )}
    >
      {nonTerminal ? <LivenessChip run={run} /> : <StatusDot run={run} />}
      <span className="text-sm font-medium text-foreground truncate">
        {friendlyProcessName(run.processId)}
      </span>
      {run.projectName && (
        <span className="flex items-center gap-1 text-xs text-foreground-muted truncate">
          <Tag className="h-3 w-3 shrink-0" />
          {run.projectName}
        </span>
      )}
      <span className="font-mono text-xs text-info">{run.runId.slice(0, 8)}</span>
      <span className="text-xs text-foreground-muted tabular-nums">
        {formatRelativeTime(run.updatedAt)}
      </span>
      <div className="ml-auto flex items-center gap-2">
        {isBreakpoint(run) && <ActionHint run={run} />}
      </div>
    </Link>
  );
}

export interface RunListProps {
  status: DashboardStatusFilter;
}

/**
 * Flat, self-fetching run list for a single status filter.
 * Fetches `/api/runs` (default mode → RunQueryService.listAllRuns) with a
 * growing-window pagination (limit grows with page, offset stays 0) so the
 * polling URL stays stable/keyed per page.
 */
export function RunList({ status }: RunListProps) {
  const [page, setPage] = useState(0);

  const params = new URLSearchParams({
    status,
    sort: "status",
    limit: String(PAGE_SIZE * (page + 1)),
    offset: "0",
    search: "",
  });
  const url = `/api/runs?${params.toString()}`;

  const sseFilter = (event: { type: string }) =>
    event.type === "update" || event.type === "new-run";
  const { data, loading, error } = useSmartPolling<RunsListResponse>(url, { sseFilter });

  if (loading && !data) {
    return (
      <div className="flex flex-col gap-2" data-testid="run-list-loading">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-11 rounded-md border border-border bg-card animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div
        data-testid="run-list-error"
        className="rounded-lg border border-error/20 bg-error-muted p-4 text-sm text-error"
      >
        Failed to load runs: {error}
      </div>
    );
  }

  const runs = data?.runs ?? [];
  const totalCount = data?.totalCount ?? 0;

  if (runs.length === 0) {
    return <EmptyState />;
  }

  const sorted = [...runs].sort((a, b) => {
    const ra = rank(a);
    const rb = rank(b);
    if (ra !== rb) return ra - rb;
    return (b.updatedAt || "").localeCompare(a.updatedAt || "");
  });

  const hasMore = runs.length < totalCount;

  return (
    <div className="flex flex-col gap-2" data-testid="run-list">
      {sorted.map((run) => (
        <RunRow key={run.runId} run={run} />
      ))}
      {hasMore && (
        <button
          onClick={() => setPage((p) => p + 1)}
          className="mt-2 px-4 py-2 text-sm text-foreground-secondary hover:text-foreground hover:bg-background-secondary transition-colors rounded-md"
        >
          Load more ({totalCount - runs.length} remaining)
        </button>
      )}
    </div>
  );
}
