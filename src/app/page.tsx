"use client";
import { useState, useMemo, useCallback } from "react";
import { useProjects } from "@/hooks/use-projects";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { ProjectHealthCard } from "@/components/dashboard/project-health-card";
import { BreakpointBanner } from "@/components/dashboard/breakpoint-banner";
import {
  FolderOpen,
  Activity,
  CheckCircle2,
  AlertCircle,
  Layers,
  Pause,
  History,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
  Eye,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { ErrorBoundary } from "@/components/shared/error-boundary";
import { GlobalSearch } from "@/components/dashboard/global-search";
import type { RunStatus, BreakpointRunInfo } from "@/types";

const filters: { label: string; value: RunStatus | "all" | "stale" }[] = [
  { label: "All", value: "all" },
  { label: "Running", value: "waiting" },
  { label: "Stale", value: "stale" },
  { label: "Completed", value: "completed" },
  { label: "Failed", value: "failed" },
];

export default function DashboardPage() {
  const { projects, recentCompletionWindowMs, loading, error, refresh } = useProjects();
  const [statusFilter, setStatusFilter] = useState<RunStatus | "all" | "stale">("all");
  const [sortMode, setSortMode] = usePersistedState<"status" | "activity">("observer:sort-mode", "status");

  // Toggle filter from metric tile: clicking active filter clears it
  const toggleMetricFilter = useCallback((filter: RunStatus | "all" | "stale") => {
    setStatusFilter((prev) => (prev === filter ? "all" : filter));
  }, []);

  const handleHideProject = useCallback((_projectName: string) => {
    // Refresh projects list to remove the hidden project from the dashboard
    refresh();
  }, [refresh]);

  // Aggregate metrics across all projects
  const metrics = useMemo(() => {
    const totalRuns = projects.reduce((s, p) => s + p.totalRuns, 0);
    const activeRuns = projects.reduce((s, p) => s + p.activeRuns, 0);
    const completedRuns = projects.reduce((s, p) => s + p.completedRuns, 0);
    const failedRuns = projects.reduce((s, p) => s + p.failedRuns, 0);
    const staleRuns = projects.reduce((s, p) => s + p.staleRuns, 0);
    const totalTasks = projects.reduce((s, p) => s + p.totalTasks, 0);
    const completedTasks = projects.reduce((s, p) => s + p.completedTasksAggregate, 0);
    return { totalRuns, activeRuns, completedRuns, failedRuns, staleRuns, totalTasks, completedTasks };
  }, [projects]);

  // Collect all breakpoint runs across all projects
  const allBreakpointRuns = useMemo<BreakpointRunInfo[]>(() => {
    return projects.flatMap((p) => p.breakpointRuns ?? []);
  }, [projects]);

  const filterCounts = useMemo(() => {
    return {
      all: metrics.totalRuns,
      waiting: metrics.activeRuns,
      stale: metrics.staleRuns,
      completed: metrics.completedRuns,
      failed: metrics.failedRuns,
      pending: 0,
    } as Record<RunStatus | "all" | "stale", number>;
  }, [metrics]);

  // Filter projects by status counts
  const filteredProjects = useMemo(() => {
    if (statusFilter === "all") return projects;
    if (statusFilter === "stale") return projects.filter((p) => p.staleRuns > 0);
    return projects.filter((project) => {
      if (statusFilter === "waiting") return project.activeRuns > 0;
      if (statusFilter === "completed") return project.completedRuns > 0;
      if (statusFilter === "failed") return project.failedRuns > 0;
      return false;
    });
  }, [projects, statusFilter]);

  // Determine the status filter to pass to ProjectHealthCard (map "stale" to "all" since it's not a RunStatus)
  const cardStatusFilter: RunStatus | "all" = statusFilter === "stale" ? "all" : statusFilter;

  // Split filtered projects into active (has active/stale runs or recently completed) and history
  const { activeProjects, historyProjects } = useMemo(() => {
    const now = Date.now();
    const active = filteredProjects.filter((p) =>
      p.activeRuns > 0 || p.staleRuns > 0 ||
      (now - new Date(p.latestUpdate).getTime() < recentCompletionWindowMs)
    );
    const history = filteredProjects.filter((p) =>
      p.activeRuns === 0 && p.staleRuns === 0 &&
      (now - new Date(p.latestUpdate).getTime() >= recentCompletionWindowMs)
    );
    return { activeProjects: active, historyProjects: history };
  }, [filteredProjects, recentCompletionWindowMs]);

  const [historyCollapsed, setHistoryCollapsed] = usePersistedState(
    "observer:history-collapsed",
    historyProjects.length > 5
  );

  // How many KPI columns: 4 base + 1 if stale > 0
  const hasStaleRuns = metrics.staleRuns > 0;
  const kpiCols = hasStaleRuns ? "grid-cols-2 sm:grid-cols-5" : "grid-cols-2 sm:grid-cols-4";

  return (
    <div className="min-h-screen bg-gradient-brand">
      {/* Header and footer are now in AppHeader/AppFooter via Providers */}

      <div className="mx-auto max-w-[1600px] px-6 py-6">
        {/* Global Search */}
        <GlobalSearch />

        {/* KPI Metrics Row */}
        {!loading && !error && projects.length > 0 && (
          <ErrorBoundary section="KPI Metrics">
            <div data-testid="kpi-grid" className={cn("grid gap-3 mb-6", kpiCols)}>
              <MetricTile
                label="Total Runs"
                value={metrics.totalRuns}
                icon={<Layers className="h-4 w-4" />}
                color="primary"
                testId="metric-tile-total-runs"
                onClick={() => toggleMetricFilter("all")}
                active={statusFilter === "all"}
              />
              <MetricTile
                label="In Progress"
                value={metrics.activeRuns}
                icon={<Activity className="h-4 w-4" />}
                color="warning"
                pulse={metrics.activeRuns > 0}
                testId="metric-tile-active"
                onClick={() => toggleMetricFilter("waiting")}
                active={statusFilter === "waiting"}
              />
              {hasStaleRuns && (
                <MetricTile
                  label="Stale"
                  value={metrics.staleRuns}
                  icon={<Pause className="h-4 w-4" />}
                  color="muted"
                  testId="metric-tile-stale"
                  onClick={() => toggleMetricFilter("stale")}
                  active={statusFilter === "stale"}
                />
              )}
              <MetricTile
                label="Completed"
                value={metrics.completedRuns}
                icon={<CheckCircle2 className="h-4 w-4" />}
                color="success"
                testId="metric-tile-completed"
                onClick={() => toggleMetricFilter("completed")}
                active={statusFilter === "completed"}
              />
              <MetricTile
                label="Failed"
                value={metrics.failedRuns}
                icon={<AlertCircle className="h-4 w-4" />}
                color="error"
                testId="metric-tile-failed"
                onClick={() => toggleMetricFilter("failed")}
                active={statusFilter === "failed"}
              />
            </div>
          </ErrorBoundary>
        )}

        {/* Global Breakpoint Banner */}
        {!loading && !error && allBreakpointRuns.length > 0 && (
          <ErrorBoundary section="Breakpoint Banner">
            <BreakpointBanner breakpointRuns={allBreakpointRuns} />
          </ErrorBoundary>
        )}

        {/* Filter pills */}
        <div className="mb-5">
          <div data-testid="filter-bar" className="flex items-center gap-1">
            {filters.map((f) => {
              const count = filterCounts[f.value] ?? 0;
              // Hide Stale filter pill when there are no stale runs
              if (f.value === "stale" && count === 0) return null;
              return (
                <button
                  key={f.value}
                  data-testid={`filter-pill-${f.value}`}
                  onClick={() => setStatusFilter(f.value)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-xs font-medium transition-all inline-flex items-center gap-1.5",
                    statusFilter === f.value
                      ? f.value === "stale"
                        ? "bg-zinc-500/10 text-zinc-500"
                        : "bg-primary/10 text-primary shadow-neon-glow-primary-xs"
                      : "text-foreground-muted hover:text-foreground-secondary hover:bg-background-secondary"
                  )}
                >
                  {f.label}
                  {count > 0 && (
                    <span className={cn(
                      "rounded-full px-1.5 py-px text-xs leading-tight font-semibold tabular-nums",
                      statusFilter === f.value
                        ? f.value === "stale"
                          ? "bg-zinc-500/20 text-zinc-500"
                          : "bg-primary/20 text-primary"
                        : "bg-background-secondary text-foreground-muted"
                    )}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
            {/* Sort toggle + Project count */}
            <div className="ml-auto flex items-center gap-2">
              <button
                data-testid="sort-toggle"
                onClick={() => setSortMode((prev) => prev === "status" ? "activity" : "status")}
                className={cn(
                  "rounded-md px-2.5 py-1.5 text-xs font-medium transition-all inline-flex items-center gap-1",
                  "text-foreground-muted hover:text-foreground-secondary hover:bg-background-secondary border border-border"
                )}
                title={sortMode === "status" ? "Sorted by status priority — click to sort by recent activity" : "Sorted by recent activity — click to sort by status priority"}
              >
                <ArrowUpDown className="h-3 w-3" />
                {sortMode === "status" ? "By Status" : "By Activity"}
              </button>
              <span data-testid="project-count" className="text-xs text-foreground-muted tabular-nums">
                {filteredProjects.length} project{filteredProjects.length !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-lg border border-border bg-card p-4 animate-pulse">
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-2.5 w-2.5 rounded-full bg-foreground-muted/20" />
                  <div className="h-4 w-32 rounded bg-foreground-muted/10" />
                </div>
                <div className="h-1.5 w-full rounded-full bg-foreground-muted/10 mb-3" />
                <div className="flex items-center gap-3">
                  <div className="h-5 w-16 rounded-full bg-foreground-muted/10" />
                  <div className="h-5 w-16 rounded-full bg-foreground-muted/10" />
                  <div className="h-3 w-12 rounded bg-foreground-muted/10" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div data-testid="error-banner" className="rounded-lg border border-error/20 bg-error-muted p-4 text-sm text-error">
            Failed to load projects: {error}
          </div>
        ) : filteredProjects.length === 0 ? (
          <div data-testid="empty-state" className="text-center py-16">
            <FolderOpen className="h-10 w-10 text-foreground-muted/30 mx-auto mb-3" />
            <p className="text-sm text-foreground-muted mb-1">No projects found</p>
            <p className="text-xs text-foreground-muted/60">
              Configure watch sources in{" "}
              <button
                onClick={() => window.dispatchEvent(new CustomEvent("open-settings"))}
                className="text-primary hover:underline"
              >
                Settings
              </button>{" "}
              or edit <span className="font-mono">~/.a5c/observer.json</span>
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            {/* Idle empty state: no active and no history runs at all */}
            {activeProjects.length === 0 && historyProjects.length === 0 && (
              <div data-testid="idle-empty-state" className="text-center py-16">
                <Eye className="h-10 w-10 text-foreground-muted/30 mx-auto mb-3" />
                <p className="text-sm text-foreground-muted mb-1">All quiet — no active orchestration runs</p>
                <p className="text-xs text-foreground-muted/60">
                  Runs will appear here when babysitter processes are started
                </p>
              </div>
            )}

            {/* Idle with history: no active runs but has history */}
            {activeProjects.length === 0 && historyProjects.length > 0 && (statusFilter === "all" || statusFilter === "stale") && (
              <div data-testid="idle-with-history-banner" className="flex items-center gap-2 px-3 py-2 rounded-md bg-background-secondary/50 border border-border w-fit">
                <Activity className="h-3.5 w-3.5 text-foreground-muted/50" />
                <span className="text-xs text-foreground-muted">No runs in progress</span>
              </div>
            )}

            {/* Active Runs section */}
            {activeProjects.length > 0 && (statusFilter === "all" || statusFilter === "stale" || statusFilter === "waiting") && (
              <ErrorBoundary section="Active Runs">
                <section data-testid="active-runs-section">
                  <div className="flex items-center gap-2 mb-3">
                    <Activity className="h-4 w-4 text-warning animate-pulse-dot" />
                    <h2 className="text-sm font-semibold text-foreground">In Progress</h2>
                    <span className="rounded-full bg-warning/10 border border-warning/20 px-2 py-px text-xs font-semibold text-warning tabular-nums">
                      {activeProjects.length}
                    </span>
                  </div>
                  <div data-testid="project-grid-active" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
                    {activeProjects.map((project) => (
                      <ProjectHealthCard
                        key={project.projectName}
                        project={project}
                        statusFilter={cardStatusFilter}
                        sortMode={sortMode}
                        onHide={handleHideProject}
                      />
                    ))}
                  </div>
                </section>
              </ErrorBoundary>
            )}

            {/* When filter is "waiting", show all filteredProjects (already filtered to active) — handled above */}

            {/* When filter is "completed" or "failed", show filteredProjects directly without sectioning */}
            {(statusFilter === "completed" || statusFilter === "failed") && (
              <ErrorBoundary section="Filtered Results">
                <div data-testid="project-grid-filtered" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
                  {filteredProjects.map((project) => (
                    <ProjectHealthCard
                      key={project.projectName}
                      project={project}
                      statusFilter={cardStatusFilter}
                      sortMode={sortMode}
                    />
                  ))}
                </div>
              </ErrorBoundary>
            )}

            {/* Recent History section */}
            {historyProjects.length > 0 && (statusFilter === "all" || statusFilter === "stale") && (
              <ErrorBoundary section="Recent History">
                <section data-testid="recent-history-section">
                  <button
                    onClick={() => setHistoryCollapsed((v) => !v)}
                    className="flex items-center gap-2 mb-3 group w-fit"
                  >
                    <History className="h-4 w-4 text-foreground-muted/70" />
                    <h2 className="text-sm font-semibold text-foreground-muted group-hover:text-foreground-secondary transition-colors">
                      Recent History
                    </h2>
                    <span className="rounded-full bg-background-secondary border border-border px-2 py-px text-xs font-semibold text-foreground-muted tabular-nums">
                      {historyProjects.length}
                    </span>
                    {historyCollapsed ? (
                      <ChevronDown className="h-3.5 w-3.5 text-foreground-muted/60 group-hover:text-foreground-muted transition-colors" />
                    ) : (
                      <ChevronUp className="h-3.5 w-3.5 text-foreground-muted/60 group-hover:text-foreground-muted transition-colors" />
                    )}
                  </button>
                  {!historyCollapsed && (
                    <div className="opacity-70">
                      <div data-testid="project-grid-history" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
                        {historyProjects.map((project) => (
                          <ProjectHealthCard
                            key={project.projectName}
                            project={project}
                            statusFilter={cardStatusFilter}
                            sortMode={sortMode}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </section>
              </ErrorBoundary>
            )}
          </div>
        )}
      </div>

      {/* Notifications and settings are now in AppHeader */}
    </div>
  );
}

/* --- KPI Metric Tile --- */
interface MetricTileProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: "primary" | "success" | "warning" | "error" | "muted";
  pulse?: boolean;
  testId?: string;
  active?: boolean;
  onClick?: () => void;
}

const colorMap: Record<MetricTileProps["color"], { text: string; bg: string; glow: string; borderL: string; ring: string }> = {
  primary: { text: "text-primary", bg: "bg-primary/10", glow: "", borderL: "", ring: "ring-primary/50" },
  success: { text: "text-success", bg: "bg-success/10", glow: "", borderL: "border-l-success/60", ring: "ring-success/50" },
  warning: { text: "text-warning", bg: "bg-warning/10", glow: "shadow-[0_0_8px_var(--warning)]", borderL: "border-l-warning/60", ring: "ring-warning/50" },
  error: { text: "text-error", bg: "bg-error/10", glow: "", borderL: "border-l-error/60", ring: "ring-error/50" },
  muted: { text: "text-zinc-500", bg: "bg-zinc-500/10", glow: "", borderL: "border-l-zinc-500/60", ring: "ring-zinc-500/50" },
};

function MetricTile({ label, value, icon, color, pulse, testId, active, onClick }: MetricTileProps) {
  const c = colorMap[color];
  const isClickable = !!onClick;
  return (
    <div
      data-testid={testId}
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onClick={onClick}
      onKeyDown={isClickable ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick?.(); } } : undefined}
      className={cn(
        "rounded-lg border border-border bg-card/80 backdrop-blur-sm p-3 flex items-center gap-3 transition-all",
        value > 0 && color !== "primary" && "border-l-2",
        value > 0 && color !== "primary" && c.borderL,
        isClickable && "cursor-pointer hover:bg-background-secondary/50",
        active && "ring-2",
        active && c.ring,
      )}
    >
      <div className={cn("rounded-md p-2", c.bg)}>
        <span className={cn(c.text, pulse && "animate-pulse-dot")}>{icon}</span>
      </div>
      <div>
        <p className={cn("text-lg font-bold tabular-nums leading-none mb-0.5", c.text)}>
          {value}
        </p>
        <p className="text-xs leading-tight text-foreground-muted uppercase tracking-wider font-medium">
          {label}
        </p>
      </div>
    </div>
  );
}
