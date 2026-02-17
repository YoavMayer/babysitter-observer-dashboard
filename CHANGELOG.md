# Changelog

All notable changes to this project will be documented in this file.

## [0.1.0] - 2026-02-18

### Added
- **Smart dashboard layout** -- Active runs shown prominently at the top; recently completed projects stay visible for a configurable recency window (default 4 hours) before moving to "Recent History"
- **Expanded project card mini-dashboard** -- When expanding a project card, runs are organized into Active Runs (always visible), Failed Runs (collapsible), and Completed History (collapsible) sections with mini KPI pills
- **Enhanced pagination controls** -- Page number buttons with ellipsis for large result sets, replacing the previous prev/next-only arrows
- **Configurable run retention** -- New "Run Retention" setting (default 30 days) filters old completed/failed runs from the dashboard for performance; active runs always shown regardless of age
- **Retention settings UI** -- New "Run Retention" section in the settings modal with days input (1-365 range)
- **Server-driven recency window** -- `recentCompletionWindowMs` is now served from the API and consumed by the client, replacing the hardcoded constant
- **Version badge** -- Dashboard version number displayed in the header bar
- **Error boundary component** -- Graceful error handling for dashboard sections
- **Resilient fetch utility** -- `resilientFetch<T>()` with retry (exponential backoff, 5xx/network only), AbortSignal integration, configurable timeout (default 10s), and normalized `FetchError` shape
- **Error handler utility** -- Centralized `normalizeError()` for consistent API error responses across all routes

### Changed
- Task detail panel Data/Output, Logs, and Agent tabs now use `max-h-[60vh]` instead of `max-h-64` (256px) for much larger scrollable content areas
- Consistent use of `animate-pulse-dot` animation across active run indicators (was mixed `animate-pulse` and `animate-pulse-dot`)
- API routes now use centralized error handling via `normalizeError()`
- Hooks use `resilientFetch` for improved reliability with automatic retry and abort support

### Fixed
- Task Detail panel Data > Output content was clipped at 256px with no way to see full output data
- Log viewer stdout/stderr/output sections had same 256px height limitation

### Configuration
- New environment variable: `OBSERVER_RETENTION_DAYS` (default: 30) -- number of days to retain completed/failed runs in the dashboard
- New environment variable: `OBSERVER_RECENT_WINDOW_MS` (default: 14400000 / 4 hours) -- how long recently completed projects stay in the Active section
- New registry fields in `~/.a5c/observer.json`: `retentionDays`, `recentCompletionWindowMs`

## [0.1.0-alpha.0] - 2026-02-17

### Added
- Initial alpha release
- Multi-project observability dashboard with health cards and KPI metrics
- Real-time Server-Sent Events (SSE) streaming for instant updates
- Pipeline visualization with step-by-step progress and parallel group rendering
- Breakpoint approval/rejection directly from the dashboard UI
- Dark and light theme support with persistence
- CLI launcher (`babysitter-observer-dashboard`) with configurable flags
- Keyboard shortcuts for power-user navigation
- Editable settings panel with persistent registry file (~/.a5c/observer.json)
- Configurable watch directories and polling intervals
- Run detail view with agent details, timing breakdowns, and raw JSON inspection
- Lightweight digest endpoint for efficient polling
- Smart adaptive polling with exponential backoff
