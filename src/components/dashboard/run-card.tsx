"use client";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { SessionPill } from "@/components/shared/session-pill";
import { TruncatedId } from "@/components/shared/truncated-id";
import { ProgressBar } from "@/components/shared/progress-bar";
import { formatDuration, friendlyProcessName, formatRelativeTime } from "@/lib/utils";
import type { Run } from "@/types";
import { Clock, Layers, Hand, AlertCircle, Tag } from "lucide-react";

interface RunCardProps {
  run: Run;
  selected?: boolean;
}

/** Map run status to progress bar variant */
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

/** Compute display progress: completed runs always show 100% */
function displayProgress(run: Run): number {
  if (run.status === "completed") return 100;
  if (run.totalTasks > 0) return Math.round((run.completedTasks / run.totalTasks) * 100);
  return 0;
}

/** Format stale time: "Stale (2h ago)", "Stale (1d ago)" */
function formatStaleTime(updatedAt: string): string {
  const relative = formatRelativeTime(updatedAt);
  return relative ? `Stale (${relative})` : "Stale";
}

export function RunCard({ run, selected }: RunCardProps) {
  const progress = displayProgress(run);
  const isActive = run.status === "waiting" || run.status === "pending";
  const isStale = run.isStale === true;

  // Find the first breakpoint task that is waiting for approval
  const pendingBreakpoint = run.tasks.find(
    (t) => t.kind === "breakpoint" && t.status === "requested"
  );
  // Prefer run-level breakpointQuestion, fall back to task-level
  const breakpointQuestion = run.breakpointQuestion ?? pendingBreakpoint?.breakpointQuestion;

  // Failure point text: run-level failedStep
  const failedStep = run.status === "failed" ? run.failedStep : undefined;

  return (
    <Link href={`/runs/${run.runId}`}>
      <Card className={cn(
        "cursor-pointer p-4 transition-all card-hover-lift",
        "hover:shadow-glow-primary/30",
        selected && "ring-1 ring-primary shadow-glow-primary",
        isActive && !isStale && "border-[var(--border-hover)]",
        pendingBreakpoint && !isStale && "border-warning/30 shadow-glow-warning",
        isStale && "opacity-50"
      )}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={cn(
                "h-2 w-2 rounded-full shrink-0",
                isStale
                  ? "bg-zinc-500"
                  : run.status === "completed" ? "bg-success shadow-[0_0_6px_var(--success)]" :
                    run.status === "failed" ? "bg-error shadow-[0_0_6px_var(--error)]" :
                    run.status === "waiting" ? "bg-warning shadow-[0_0_6px_var(--warning)] animate-pulse-dot" :
                    "bg-pending"
              )} />
              <span className="text-base font-medium text-foreground truncate">
                {friendlyProcessName(run.processId)}
              </span>
              <StatusBadge
                status={run.status}
                waitingKind={run.waitingKind}
                isStale={isStale}
              />
              {isStale && (
                <span className="inline-flex items-center rounded-full bg-zinc-500/10 border border-zinc-500/20 px-2 py-0.5 text-[10px] leading-tight font-medium text-zinc-500 shrink-0">
                  {formatStaleTime(run.updatedAt)}
                </span>
              )}
              {run.projectName && (
                <span className="inline-flex items-center gap-1 rounded-full bg-background-secondary px-2 py-0.5 text-[10px] leading-tight font-medium text-foreground-muted shrink-0">
                  <Tag className="h-2.5 w-2.5" />
                  {run.projectName}
                </span>
              )}
              {run.sourceLabel && run.sourceLabel !== run.projectName && (
                <span className="rounded-full bg-background-secondary px-2 py-0.5 text-[10px] leading-tight text-foreground-muted shrink-0">
                  {run.sourceLabel}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <TruncatedId id={run.runId} chars={4} className="text-foreground-secondary" />
            </div>
            {/* Inline failure point for failed runs */}
            {failedStep && (
              <div className="flex items-center gap-1.5 mt-2 px-2 py-1 rounded-md bg-error-muted border border-error/20 border-l-2 border-l-error shadow-glow-error">
                <AlertCircle className="h-3.5 w-3.5 text-error shrink-0" />
                <span className="text-xs text-error truncate">
                  Failed at: {failedStep.length > 80 ? failedStep.slice(0, 80) + "..." : failedStep}
                </span>
              </div>
            )}
            {/* Breakpoint question pill */}
            {pendingBreakpoint && breakpointQuestion && (
              <div className="flex items-center gap-1.5 mt-2 px-2 py-1.5 rounded-md bg-warning-muted border border-warning/20 border-l-2 border-l-warning animate-breakpoint-glow">
                <Hand className="h-3.5 w-3.5 text-warning shrink-0" />
                <span className="text-xs text-warning truncate">
                  {breakpointQuestion.length > 80
                    ? breakpointQuestion.slice(0, 80) + "..."
                    : breakpointQuestion}
                </span>
              </div>
            )}
            <div className="flex items-center gap-3 mt-2 text-xs text-foreground-muted">
              <SessionPill sessionId={run.sessionId} active={isActive && !isStale} />
              <span className="inline-flex items-center gap-1">
                <Layers className="h-3 w-3" />
                {run.completedTasks}/{run.totalTasks} tasks
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatDuration(run.duration)}
              </span>
            </div>
          </div>
        </div>
        {/* Task 1.8 — Show progress bar for ALL runs, not just active */}
        {run.totalTasks > 0 && (
          <ProgressBar value={progress} variant={progressVariant(run.status)} glow={isActive && !isStale} className="mt-4" />
        )}
      </Card>
    </Link>
  );
}
