"use client";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { Card } from "@/components/ui/card";
import { RunCard } from "./run-card";
import { PaginationControls } from "./pagination-controls";
import { useProjectRuns } from "@/hooks/use-project-runs";
import { formatRelativeTime } from "@/lib/utils";
import type { ProjectSummary, RunStatus } from "@/types";
import {
  Activity,
  CheckCircle2,
  AlertCircle,
  Layers,
  ChevronDown,
  ChevronUp,
  Clock,
  Pause,
  History,
} from "lucide-react";

interface ProjectHealthCardProps {
  project: ProjectSummary;
  statusFilter: RunStatus | "all";
}

type HealthStatus = "healthy" | "active" | "stale" | "failing";

function getHealthStatus(project: ProjectSummary): HealthStatus {
  if (project.failedRuns > 0) return "failing";
  if (project.activeRuns > 0) return "active";
  if (project.staleRuns > 0) return "stale";
  return "healthy";
}

const healthConfig: Record<
  HealthStatus,
  { dotClass: string; borderClass: string; icon: typeof CheckCircle2; label: string; barColor: string }
> = {
  healthy: {
    dotClass: "bg-success shadow-[0_0_6px_var(--success)]",
    borderClass: "border-success/20 hover:border-success/40",
    icon: CheckCircle2,
    label: "Healthy",
    barColor: "bg-success",
  },
  active: {
    dotClass: "bg-warning shadow-[0_0_6px_var(--warning)] animate-pulse-dot",
    borderClass: "border-warning/20 hover:border-warning/40",
    icon: Activity,
    label: "Active",
    barColor: "bg-warning",
  },
  stale: {
    dotClass: "bg-zinc-500",
    borderClass: "border-zinc-500/20 hover:border-zinc-500/40",
    icon: Pause,
    label: "Stale",
    barColor: "bg-zinc-500",
  },
  failing: {
    dotClass: "bg-error shadow-[0_0_6px_var(--error)]",
    borderClass: "border-error/20 hover:border-error/40",
    icon: AlertCircle,
    label: "Failing",
    barColor: "bg-error",
  },
};

const PAGE_SIZE = 5;

export function ProjectHealthCard({ project, statusFilter }: ProjectHealthCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [page, setPage] = useState(0);
  const [showCompleted, setShowCompleted] = useState(false);
  const [showFailed, setShowFailed] = useState(false);

  const health = getHealthStatus(project);
  const config = healthConfig[health];
  const StatusIcon = config.icon;

  const taskProgress = project.totalTasks > 0
    ? Math.round((project.completedTasksAggregate / project.totalTasks) * 100)
    : 0;

  const { runs, totalCount, loading } = useProjectRuns(
    project.projectName,
    {
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
      status: statusFilter === "all" ? "" : statusFilter,
      enabled: expanded,
    }
  );

  return (
    <Card
      data-testid={`project-card-${project.projectName}`}
      className={cn(
        "transition-all duration-200 overflow-hidden card-hover-lift",
        config.borderClass,
        expanded && "ring-1 ring-primary/20"
      )}
    >
      {/* Card header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left p-4 hover:bg-background-secondary/30 transition-colors"
      >
        {/* Row 1: Project title — full width, visually dominant */}
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold text-foreground truncate flex-1">
            {project.projectName}
          </h3>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-foreground-muted shrink-0 ml-2" />
          ) : (
            <ChevronDown className="h-4 w-4 text-foreground-muted shrink-0 ml-2" />
          )}
        </div>

        {/* Row 2: Health status + run count badges */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3 text-xs text-foreground-muted">
            <span className="inline-flex items-center gap-1.5">
              <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", config.dotClass)} />
              <StatusIcon className="h-3 w-3" />
              {config.label}
            </span>
            <span className="inline-flex items-center gap-1">
              <Layers className="h-3 w-3" />
              {project.totalRuns}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatRelativeTime(project.latestUpdate)}
            </span>
          </div>
          {/* Compact status badges */}
          <div className="flex items-center gap-1.5 shrink-0">
            {project.activeRuns > 0 && (
              <span className="inline-flex items-center rounded-full bg-warning/10 border border-warning/20 px-1.5 py-0.5 text-[10px] leading-tight font-medium text-warning tabular-nums">
                {project.activeRuns}
              </span>
            )}
            {project.staleRuns > 0 && (
              <span className="inline-flex items-center rounded-full bg-zinc-500/10 border border-zinc-500/20 px-1.5 py-0.5 text-[10px] leading-tight font-medium text-zinc-500 tabular-nums">
                {project.staleRuns}
              </span>
            )}
            {project.completedRuns > 0 && (
              <span className="inline-flex items-center rounded-full bg-success/10 border border-success/20 px-1.5 py-0.5 text-[10px] leading-tight font-medium text-success tabular-nums">
                {project.completedRuns}
              </span>
            )}
            {project.failedRuns > 0 && (
              <span className="inline-flex items-center rounded-full bg-error/10 border border-error/20 px-1.5 py-0.5 text-[10px] leading-tight font-medium text-error tabular-nums">
                {project.failedRuns}
              </span>
            )}
          </div>
        </div>

        {/* Row 3: Mini progress bar — task completion */}
        {project.totalTasks > 0 && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] leading-tight text-foreground-muted">
                {project.completedTasksAggregate}/{project.totalTasks} tasks
              </span>
              <span className="text-[10px] leading-tight text-foreground-muted tabular-nums">
                {taskProgress}%
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-background-secondary overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all duration-500", config.barColor)}
                style={{ width: `${taskProgress}%` }}
              />
            </div>
          </div>
        )}
      </button>

      {/* Expanded: runs list — split into active and completed */}
      {expanded && (() => {
        const activeRuns = runs.filter((r) => r.status === "waiting" || r.status === "pending" || r.isStale);
        const successRuns = runs.filter((r) => r.status === "completed" && !r.isStale);
        const failedRuns = runs.filter((r) => r.status === "failed" && !r.isStale);
        const hasActiveRuns = activeRuns.length > 0;
        const hasSuccessRuns = successRuns.length > 0;
        const hasFailedRuns = failedRuns.length > 0;

        return (
          <div className="border-t border-border px-4 pb-4 pt-3">
            {loading && runs.length === 0 ? (
              <div className="flex flex-col gap-2">
                {[1, 2].map((i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-border bg-background p-3 animate-pulse"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className="h-2 w-2 rounded-full bg-foreground-muted/20" />
                      <div className="h-3 w-32 rounded bg-foreground-muted/10" />
                    </div>
                    <div className="h-2 w-full rounded bg-foreground-muted/10" />
                  </div>
                ))}
              </div>
            ) : runs.length === 0 ? (
              <p className="text-xs text-foreground-muted text-center py-4">No matching runs</p>
            ) : (
              <div className="flex flex-col gap-3">
                {/* Mini KPI Row */}
                <div className={cn("grid gap-2 mb-3", project.staleRuns > 0 ? "grid-cols-4" : "grid-cols-3")}>
                  <MiniKpiPill icon={<Activity className="h-3.5 w-3.5" />} count={project.activeRuns} label="Active" colorClass="text-warning" bgClass="bg-warning/10" pulse={project.activeRuns > 0} />
                  {project.staleRuns > 0 && (
                    <MiniKpiPill icon={<Pause className="h-3.5 w-3.5" />} count={project.staleRuns} label="Stale" colorClass="text-zinc-500" bgClass="bg-zinc-500/10" />
                  )}
                  <MiniKpiPill icon={<CheckCircle2 className="h-3.5 w-3.5" />} count={project.completedRuns} label="Completed" colorClass="text-success" bgClass="bg-success/10" />
                  <MiniKpiPill icon={<AlertCircle className="h-3.5 w-3.5" />} count={project.failedRuns} label="Failed" colorClass="text-error" bgClass="bg-error/10" />
                </div>

                {/* Active runs — always visible with section header */}
                {hasActiveRuns && (
                  <div className="mb-2">
                    <div className="flex items-center gap-2 mb-2">
                      <Activity className="h-3.5 w-3.5 text-warning animate-pulse-dot" />
                      <span className="text-xs font-semibold text-foreground">Active Runs</span>
                      <span className="rounded-full bg-warning/10 border border-warning/20 px-2 py-px text-[10px] font-semibold text-warning tabular-nums">
                        {activeRuns.length}
                      </span>
                    </div>
                    <div className="flex flex-col gap-2">
                      {activeRuns.map((run) => (<RunCard key={run.runId} run={run} />))}
                    </div>
                  </div>
                )}

                {/* Failed runs — collapsible section */}
                {hasFailedRuns && (
                  <div>
                    <button
                      onClick={(e) => { e.stopPropagation(); setShowFailed((v) => !v); }}
                      className="flex items-center gap-2 py-1.5 text-xs group w-fit"
                    >
                      <AlertCircle className="h-3.5 w-3.5 text-error/70" />
                      <span className="font-semibold text-error/80 group-hover:text-error transition-colors">Failed Runs</span>
                      <span className="rounded-full bg-error/10 border border-error/20 px-2 py-px text-[10px] font-semibold text-error tabular-nums">
                        {failedRuns.length}
                      </span>
                      {showFailed ? (
                        <ChevronUp className="h-3 w-3 text-error/40 group-hover:text-error/60" />
                      ) : (
                        <ChevronDown className="h-3 w-3 text-error/40 group-hover:text-error/60" />
                      )}
                    </button>
                    {showFailed && (
                      <div className="flex flex-col gap-2 mt-1 opacity-70">
                        {failedRuns.map((run) => (<RunCard key={run.runId} run={run} />))}
                      </div>
                    )}
                  </div>
                )}

                {/* Completed runs — collapsible section */}
                {hasSuccessRuns && (
                  <div>
                    <button
                      onClick={(e) => { e.stopPropagation(); setShowCompleted((v) => !v); }}
                      className="flex items-center gap-2 py-1.5 text-xs group w-fit"
                    >
                      <History className="h-3.5 w-3.5 text-foreground-muted/70" />
                      <span className="font-semibold text-foreground-muted group-hover:text-foreground-secondary transition-colors">Completed History</span>
                      <span className="rounded-full bg-background-secondary border border-border px-2 py-px text-[10px] font-semibold text-foreground-muted tabular-nums">
                        {successRuns.length}
                      </span>
                      {showCompleted ? (
                        <ChevronUp className="h-3 w-3 text-foreground-muted/60 group-hover:text-foreground-muted" />
                      ) : (
                        <ChevronDown className="h-3 w-3 text-foreground-muted/60 group-hover:text-foreground-muted" />
                      )}
                    </button>
                    {showCompleted && (
                      <div className="flex flex-col gap-2 mt-1 opacity-60">
                        {successRuns.map((run) => (<RunCard key={run.runId} run={run} />))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            {totalCount > PAGE_SIZE && (
              <PaginationControls
                currentPage={page}
                totalItems={totalCount}
                itemsPerPage={PAGE_SIZE}
                onPageChange={setPage}
                className="mt-3"
              />
            )}
          </div>
        );
      })()}
    </Card>
  );
}

function MiniKpiPill({ icon, count, label, colorClass, bgClass, pulse }: {
  icon: React.ReactNode; count: number; label: string; colorClass: string; bgClass: string; pulse?: boolean;
}) {
  return (
    <div className={cn("rounded-md px-2.5 py-1.5 flex items-center gap-2", bgClass)}>
      <span className={cn(colorClass, pulse && "animate-pulse")}>{icon}</span>
      <div>
        <p className={cn("text-sm font-bold tabular-nums leading-none", colorClass)}>{count}</p>
        <p className="text-[9px] leading-tight text-foreground-muted uppercase tracking-wider">{label}</p>
      </div>
    </div>
  );
}
