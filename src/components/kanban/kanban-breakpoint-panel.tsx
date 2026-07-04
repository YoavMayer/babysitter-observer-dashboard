"use client";
import { useState } from "react";
import { ChevronDown, ChevronUp, Hand } from "lucide-react";
import { useTaskDetail } from "@/hooks/use-run-detail";
import { BreakpointApproval } from "@/components/breakpoint/breakpoint-approval";
import { ActionHint } from "@/components/dashboard/run-list";
import type { BoardRun } from "@/components/kanban/column-model";

/**
 * Needs-you card expansion — SPEC-vibekanban §5 (F2 lesson: never a blind
 * Approve). Renders the FULL breakpoint question (not truncated), one chip per
 * BreakpointPayload option, the driver-aware informing hint (reused ActionHint:
 * "No live driver — resume to answer" vs "Answer in terminal" + copy-run-id),
 * and an expandable Answer section that mounts the EXISTING BreakpointApproval
 * component unchanged — approveBreakpoint stays the ONLY write path.
 *
 * The option payload comes from the existing task-detail endpoint via
 * useTaskDetail (GET only; the board invents no approval affordance the
 * run-detail page doesn't already have).
 */

export interface KanbanBreakpointPanelProps {
  run: BoardRun;
}

export function KanbanBreakpointPanel({ run }: KanbanBreakpointPanelProps) {
  const [expanded, setExpanded] = useState(false);

  // The pending breakpoint effect this card is waiting on (same gating as
  // use-run-detail's hasBreakpointWaiting).
  const pendingBreakpoint = run.tasks.find(
    (t) => t.kind === "breakpoint" && t.status === "requested"
  );

  // Full BreakpointPayload (question/options) from the existing task-detail
  // endpoint. Enabled only when a pending breakpoint task actually exists.
  const { task } = useTaskDetail(run.runId, pendingBreakpoint?.effectId ?? null);

  if (!pendingBreakpoint) {
    // Legacy run shapes (pendingBreakpoints heuristics) without a visible
    // breakpoint task: nothing actionable to show on-card.
    return null;
  }

  // Full question, never truncated (AC-14): prefer the run-level question the
  // parser extracted, then the task effect's, then the fetched payload's.
  const question =
    run.breakpointQuestion ||
    pendingBreakpoint.breakpointQuestion ||
    task?.breakpoint?.question ||
    "Approval required";
  const options = task?.breakpoint?.options ?? [];

  return (
    // relative z-10 lifts the whole decision surface above the card's
    // stretched overlay link so chips/toggle/approval are interactive
    // (RunRow a11y-nested-interactive-copy-btn pattern).
    <div
      data-testid="kanban-bp-panel"
      className="relative z-10 mt-1 flex flex-col gap-2 rounded-md border border-warning/30 bg-warning-muted p-2"
    >
      {/* "NEEDS YOU" label + full question (§5: the human decision on-card). */}
      <div className="flex items-center gap-1.5">
        <Hand
          className="h-3.5 w-3.5 text-warning animate-pulse-dot"
          aria-hidden="true"
          focusable="false"
        />
        <span className="text-[10px] font-bold text-warning uppercase tracking-wider">
          Needs you
        </span>
      </div>
      <p className="text-xs text-foreground font-medium leading-relaxed whitespace-pre-wrap break-words">
        {question}
      </p>

      {/* One chip per option from BreakpointPayload.options (informative —
          answering happens through BreakpointApproval below). */}
      {options.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {options.map((option) => (
            <span
              key={option}
              data-testid="kanban-bp-option-chip"
              className="inline-flex items-center rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 text-xs leading-tight font-medium text-warning"
            >
              {option}
            </span>
          ))}
        </div>
      )}

      {/* Driver-aware informing hint, identical to the banner/flat-list
          pattern: orphaned/none => "No live driver — resume to answer" +
          copy-run-id; live => "Answer in terminal". */}
      <div className="flex">
        <ActionHint run={run} />
      </div>

      {/* Expandable Answer section mounting the existing BreakpointApproval
          (the ONLY write path) — never a blind approve. */}
      <button
        type="button"
        data-testid="kanban-bp-answer-toggle"
        aria-expanded={expanded}
        onClick={() => setExpanded((prev) => !prev)}
        className="inline-flex items-center gap-1 self-start rounded-md border border-border bg-background px-2 py-1 text-xs font-medium text-foreground-secondary hover:text-foreground hover:bg-background-secondary transition-colors"
      >
        {expanded ? (
          <ChevronUp className="h-3 w-3" aria-hidden="true" focusable="false" />
        ) : (
          <ChevronDown className="h-3 w-3" aria-hidden="true" focusable="false" />
        )}
        Answer
      </button>
      {expanded &&
        (task ? (
          <BreakpointApproval task={task} runId={run.runId} />
        ) : (
          <p className="text-xs text-foreground-muted italic">
            Loading breakpoint details…
          </p>
        ))}
    </div>
  );
}
