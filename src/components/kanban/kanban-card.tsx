"use client";
import Link from "next/link";
import { EyeOff, AlertCircle, Tag } from "lucide-react";
import { cn } from "@/lib/cn";
import { friendlyProcessName, formatRelativeTime } from "@/lib/utils";
import { ProgressBar } from "@/components/shared/progress-bar";
import {
  LivenessChip,
  StatusDot,
  ActionHint,
} from "@/components/dashboard/run-list";
import { assignColumn, type BoardRun } from "@/components/kanban/column-model";
import {
  KanbanBreakpointPanel,
  ACTION_HINT_FIT_CLASS,
} from "@/components/kanban/kanban-breakpoint-panel";
import type { UseBoardKeyboardResult } from "@/components/kanban/use-board-keyboard";
import type { Run } from "@/types";

/**
 * Base kanban board card — SPEC-vibekanban §5 (compact, ~72–96px).
 *
 * Borrows the flat-list row vocabulary from run-list.tsx / run-card.tsx; every
 * element is REUSED, not reinvented:
 *   row 1: LivenessChip (live/orphaned) for non-terminal runs, StatusDot for
 *          terminal runs (AC-26 chip gating) + project tag (+ EyeOff marker
 *          for hidden-project needs-you cards, §6.3)
 *   row 2: title = friendlyProcessName(processId), truncated
 *   row 3: mono short-id (8 chars) · age (F7: ≥48h renders in days) · tasks
 *   footer: slim ProgressBar (variant by status, as run-card.tsx)
 *
 * Whole card is a stretched-overlay Link to /runs/{runId}; interactive
 * children are siblings above the overlay at z-10 (the RunRow
 * a11y-nested-interactive-copy-btn pattern). Read-only: renders state, never
 * mutates it.
 */

/** Whether a run is still in progress (same guard as run-list.tsx). */
function isNonTerminal(run: BoardRun): boolean {
  return run.status === "waiting" || run.status === "pending";
}

/** Map run status to progress bar variant (as run-card.tsx progressVariant). */
function progressVariant(status: Run["status"]): "default" | "success" | "error" | "warning" {
  switch (status) {
    case "completed":
      return "success";
    case "failed":
      return "error";
    case "waiting":
      return "warning";
    default:
      return "default";
  }
}

/** Display progress: completed runs always show 100% (as run-card.tsx). */
function displayProgress(run: BoardRun): number {
  if (run.status === "completed") return 100;
  if (run.totalTasks > 0) return Math.round((run.completedTasks / run.totalTasks) * 100);
  return 0;
}

export interface KanbanCardProps {
  run: BoardRun;
  /** §8 roving tabindex wiring (from useBoardKeyboard, via the column). */
  keyboard?: UseBoardKeyboardResult;
}

export function KanbanCard({ run, keyboard }: KanbanCardProps) {
  const nonTerminal = isNonTerminal(run);
  const column = assignColumn(run);
  // Stale time chip text, as run-card.tsx formatStaleTime.
  const staleTime = formatRelativeTime(run.updatedAt);
  // §4 belt-and-braces junk rule: a run with no tasks AND no journal events
  // gets the muted "no journal data" treatment (it can't have breakpoints, so
  // it never reaches Needs-you anyway).
  const noJournalData = run.totalTasks === 0 && run.totalEvents === 0;
  // Failure point text: prefer run-level failedStep, then failureMessage
  // (as run-card.tsx), 80-char truncation.
  const failedStep =
    run.status === "failed" ? run.failedStep || run.failureMessage : undefined;

  return (
    // a11y-no-list-semantics: the column renders role="list"; each card is a
    // listitem (same semantics contract as the flat list).
    <div
      role="listitem"
      data-testid="kanban-card"
      data-run-id={run.runId}
      // §8 roving tabindex: exactly one card on the board is the tab stop;
      // the rest are focusable programmatically (arrow-key moves) only.
      tabIndex={
        keyboard ? (keyboard.tabStopRunId === run.runId ? 0 : -1) : undefined
      }
      onFocus={
        keyboard
          ? (e) => {
              // Adopt only focus on the card itself, not on inner controls.
              if (e.target === e.currentTarget) keyboard.onCardFocus(run.runId);
            }
          : undefined
      }
      onKeyDown={
        keyboard ? (e) => keyboard.onCardKeyDown(e, run.runId) : undefined
      }
      className={cn(
        "group relative flex flex-col gap-1.5 px-3 py-2 rounded-md",
        "border border-border bg-card hover:bg-background-secondary transition-colors",
        // §8 keyboard focus: a visible ring for the roving tab stop.
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
        // Column tones (§3.2): stale cards get the 50% opacity treatment,
        // completed cards are the most muted.
        column === "stale" && "opacity-50",
        column === "completed" && "opacity-70",
        noJournalData && "opacity-60"
      )}
    >
      {/* Stretched overlay link — whole card navigates to the run page;
          interactive siblings sit above it at z-10 (RunRow pattern). */}
      <Link
        href={`/runs/${run.runId}`}
        data-testid="kanban-card-link"
        aria-label={`Open run ${friendlyProcessName(run.processId)} (${run.runId.slice(0, 8)})`}
        className="absolute inset-0 z-0 rounded-md"
      />

      {/* Row 1: liveness/status chip + project tag */}
      <div className="flex items-center gap-2 min-w-0">
        {nonTerminal ? <LivenessChip run={run} /> : <StatusDot run={run} />}
        {run.projectName && (
          <span className="ml-auto flex items-center gap-1 text-xs text-foreground-muted truncate">
            <Tag className="h-3 w-3 shrink-0" aria-hidden="true" focusable="false" />
            {run.projectName}
            {run.hiddenProject && (
              // §6.3: hidden-project needs-you cards are marked, never dropped.
              <span title="project hidden from grid">
                <EyeOff
                  className="h-3 w-3 shrink-0 text-foreground-muted"
                  aria-hidden="true"
                  focusable="false"
                />
                <span className="sr-only">project hidden from grid</span>
              </span>
            )}
          </span>
        )}
      </div>

      {/* Row 2: friendly process name — design-QA (nit): 2-line clamp instead
          of a mid-word single-line ellipsis at the 280px column width. */}
      <span className="text-sm font-medium text-foreground line-clamp-2 break-words">
        {friendlyProcessName(run.processId)}
      </span>

      {/* Row 3: mono short-id · age · task progress */}
      <div className="flex items-center gap-2 text-xs text-foreground-muted">
        <span className="font-mono text-info">{run.runId.slice(0, 8)}</span>
        <span className="tabular-nums">{formatRelativeTime(run.updatedAt)}</span>
        <span className="tabular-nums">
          {run.completedTasks}/{run.totalTasks} tasks
        </span>
        {noJournalData && <span className="italic">no journal data</span>}
      </div>

      {/* Column-specific additions (§5) */}
      {column === "needsyou" && <KanbanBreakpointPanel run={run} />}
      {column === "orphaned" && (
        // Design-QA (major): ACTION_HINT_FIT_CLASS keeps the shared shrink-0
        // hint cluster wrapping INSIDE the 280px card (see the export's doc).
        <div className={ACTION_HINT_FIT_CLASS}>
          <ActionHint run={run} />
        </div>
      )}
      {column === "stale" && (
        <span className="inline-flex self-start items-center rounded-full bg-zinc-500/10 border border-zinc-500/20 px-2 py-0.5 text-xs leading-tight font-medium text-zinc-500">
          {staleTime ? `Stale (${staleTime})` : "Stale"}
        </span>
      )}
      {column === "failed" && failedStep && (
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-error-muted border border-error/20 border-l-2 border-l-error">
          <AlertCircle className="h-3.5 w-3.5 text-error shrink-0" aria-hidden="true" focusable="false" />
          <span className="text-xs text-error truncate">
            Failed at: {failedStep.length > 80 ? failedStep.slice(0, 80) + "..." : failedStep}
          </span>
        </div>
      )}

      {/* Slim progress bar (variant by status, as run-card.tsx) */}
      {run.totalTasks > 0 && (
        <ProgressBar
          value={displayProgress(run)}
          variant={progressVariant(run.status)}
          className="mt-0.5 h-1"
        />
      )}
    </div>
  );
}
