"use client";
import { useCallback, useMemo } from "react";
import { useRunDashboard, type DashboardStatusFilter } from "@/hooks/use-run-dashboard";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { BreakpointBanner } from "@/components/dashboard/breakpoint-banner";
import { CatchUpBanner } from "@/components/dashboard/catch-up-banner";
import { ExecutiveSummaryBanner } from "@/components/dashboard/executive-summary-banner";
import { KpiGrid } from "@/components/dashboard/kpi-grid";
import { RunFilterBar } from "@/components/dashboard/run-filter-bar";
import { ProjectListView } from "@/components/dashboard/project-list-view";
import { RunList } from "@/components/dashboard/run-list";
import { ErrorBoundary } from "@/components/shared/error-boundary";
import { GlobalSearch } from "@/components/dashboard/global-search";
import { KanbanBoard } from "@/components/kanban/kanban-board";
import type { BoardColumnKey } from "@/components/kanban/column-model";
import { ViewToggle, type DashboardView } from "@/components/kanban/view-toggle";

/** Status-pill values that map 1:1 onto board columns (§6.2). */
const BOARD_COLUMN_KEYS: ReadonlySet<string> = new Set([
  "needsyou",
  "orphaned",
  "waiting",
  "stale",
  "failed",
  "completed",
]);

export default function DashboardPage() {
  const {
    projects,
    loading,
    error,
    metrics,
    allBreakpointRuns,
    summaryMetrics,
    bannerFingerprint,
    bannerDismissed,
    filterCounts,
    filteredProjects,
    activeProjects,
    historyProjects,
    hiddenProjectCount,
    statusFilter,
    sortMode,
    historyCollapsed,
    cardStatusFilter,
    hasStaleRuns,
    catchUp,
    setStatusFilter,
    setSortMode,
    setHistoryCollapsed,
    setDismissedFingerprint,
    toggleMetricFilter,
    handleHideProject,
  } = useRunDashboard();

  // Board/list view (SPEC-vibekanban §6.1): persisted per browser, board default.
  const [view, setView] = usePersistedState<DashboardView>(
    "observer:dashboard-view",
    "board"
  );

  // §6.3 grid parity: registry-hidden project names — the board excludes their
  // runs from every column except the Needs-you alarm surface.
  const hiddenProjectNames = useMemo(
    () => new Set(projects.filter((p) => p.hidden).map((p) => p.projectName)),
    [projects]
  );

  // §6.2: in board view a status pill does not swap to a flat list — it
  // FOCUSES the matching column. Clicking the already-active pill (or "All")
  // clears the focus. List mode keeps today's filter behavior untouched.
  const focusColumnKey: BoardColumnKey | null =
    view === "board" && BOARD_COLUMN_KEYS.has(statusFilter)
      ? (statusFilter as BoardColumnKey)
      : null;
  const handleStatusFilterChange = useCallback(
    (value: DashboardStatusFilter) => {
      if (view === "board" && value !== "all" && value === statusFilter) {
        setStatusFilter("all");
        return;
      }
      setStatusFilter(value);
    },
    [view, statusFilter, setStatusFilter]
  );

  // §7 fetch-window tails: "View all in list →" switches to list view with
  // that column's status filter pre-applied (column keys = pill values 1:1).
  const handleViewAllInList = useCallback(
    (key: BoardColumnKey) => {
      setStatusFilter(key);
      setView("list");
    },
    [setStatusFilter, setView]
  );

  const showBanners = !loading && !error && projects.length > 0;

  return (
    <div className="bg-gradient-brand flex-1">
      <div className="mx-auto max-w-[1600px] px-6 py-6">
        {/* Global Search */}
        <GlobalSearch />

        {/* Executive Summary Banner */}
        {showBanners && (
          <ErrorBoundary section="Executive Summary">
            <ExecutiveSummaryBanner
              metrics={summaryMetrics}
              onFilterChange={setStatusFilter}
              dismissed={bannerDismissed}
              onDismiss={() => setDismissedFingerprint(bannerFingerprint)}
            />
          </ErrorBoundary>
        )}

        {/* KPI Metrics Row */}
        {showBanners && (
          <ErrorBoundary section="KPI Metrics">
            <KpiGrid
              metrics={metrics}
              statusFilter={statusFilter}
              hasStaleRuns={hasStaleRuns}
              onToggleFilter={toggleMetricFilter}
            />
          </ErrorBoundary>
        )}

        {/* Catch-up mode banner — shown when burst of SSE updates detected */}
        {catchUp.active && (
          <CatchUpBanner
            catchUp={catchUp}
            summary={{
              failedRuns: summaryMetrics.failedRuns,
              completedRuns: summaryMetrics.completedRuns,
              pendingBreakpoints: summaryMetrics.pendingBreakpoints,
            }}
          />
        )}

        {/* Global Breakpoint Banner — pinned with sticky positioning */}
        {!loading && !error && allBreakpointRuns.length > 0 && (
          <ErrorBoundary section="Breakpoint Banner">
            {/* D2: keep ONLY the header sticky. Both being `sticky top-0` made the banner
                cover the header on scroll; a fixed `top-N` offset is fragile (the header is
                ~69px and varies). Rendering the banner as a normal block at the top of the
                scroll area makes overlap impossible regardless of header height. Pending
                breakpoints remain surfaced via the sticky header's summary metrics. */}
            <div className="z-20">
              <BreakpointBanner breakpointRuns={allBreakpointRuns} />
            </div>
          </ErrorBoundary>
        )}

        {/* Filter pills + sort toggle */}
        <RunFilterBar
          statusFilter={statusFilter}
          onStatusFilterChange={handleStatusFilterChange}
          filterCounts={filterCounts}
          sortMode={sortMode}
          onSortModeToggle={() => setSortMode((prev) => prev === "status" ? "activity" : "status")}
          filteredProjectCount={filteredProjects.length}
          hiddenProjectCount={hiddenProjectCount}
          viewToggle={<ViewToggle view={view} onViewChange={setView} />}
          boardView={view === "board"}
        />

        {/* Content: board view (default), or the unchanged list view —
            project grid for "all", flat filtered run list otherwise */}
        {view === "board" ? (
          <ErrorBoundary section="Run Board">
            <KanbanBoard
              hiddenProjects={hiddenProjectNames}
              suppressSseRefetch={catchUp.active}
              focusColumnKey={focusColumnKey}
              onViewAllInList={handleViewAllInList}
            />
          </ErrorBoundary>
        ) : statusFilter === "all" ? (
          <ProjectListView
            loading={loading}
            error={error}
            filteredProjects={filteredProjects}
            activeProjects={activeProjects}
            historyProjects={historyProjects}
            statusFilter={statusFilter}
            sortMode={sortMode}
            cardStatusFilter={cardStatusFilter}
            historyCollapsed={historyCollapsed}
            onHistoryCollapsedChange={setHistoryCollapsed}
            onHideProject={handleHideProject}
          />
        ) : (
          <ErrorBoundary section="Run List">
            <RunList status={statusFilter} />
          </ErrorBoundary>
        )}
      </div>
    </div>
  );
}
