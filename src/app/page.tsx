"use client";
import { useRunDashboard } from "@/hooks/use-run-dashboard";
import { BreakpointBanner } from "@/components/dashboard/breakpoint-banner";
import { CatchUpBanner } from "@/components/dashboard/catch-up-banner";
import { ExecutiveSummaryBanner } from "@/components/dashboard/executive-summary-banner";
import { KpiGrid } from "@/components/dashboard/kpi-grid";
import { RunFilterBar } from "@/components/dashboard/run-filter-bar";
import { ProjectListView } from "@/components/dashboard/project-list-view";
import { RunList } from "@/components/dashboard/run-list";
import { ErrorBoundary } from "@/components/shared/error-boundary";
import { GlobalSearch } from "@/components/dashboard/global-search";

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
          onStatusFilterChange={setStatusFilter}
          filterCounts={filterCounts}
          sortMode={sortMode}
          onSortModeToggle={() => setSortMode((prev) => prev === "status" ? "activity" : "status")}
          filteredProjectCount={filteredProjects.length}
        />

        {/* Content: project grid for "all", flat filtered run list otherwise */}
        {statusFilter === "all" ? (
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
