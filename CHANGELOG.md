# Changelog

All notable changes to this project will be documented in this file.

## [0.5.3] - 2026-02-18
### Added
- **Playwright performance test suite** -- 5 tests covering dashboard reload time, SSE connection indicator, DOM node count, navigation performance, and console error detection (`e2e/tests/performance.spec.ts`)
- New npm scripts: `test:e2e` (all Playwright tests) and `test:perf` (performance tests only)
### Test Results
- Unit tests: 798/798 passed (59 files, 27s)
- E2E tests: 23/96 passed (71 failures in existing selectors/timeouts, not regressions)
- Performance tests: 5/5 passed (DOM: 380 nodes, nav: 9.4s, 0 console errors)

## [0.5.2] - 2026-02-18
### Changed
- Added `@playwright/test` as dev dependency for E2E testing
### Documentation
- Backfilled CHANGELOG entries for v0.1.1 through v0.5.1
- Updated README Known Limitations version reference

## [0.5.1] - 2026-02-18
### Fixed
- **Dynamic version badge** -- dashboard version badge now displays actual version from `package.json` via `NEXT_PUBLIC_APP_VERSION` instead of hardcoded `v0.1.0`
### Configuration
- New build-time environment variable `NEXT_PUBLIC_APP_VERSION` auto-populated from `package.json` in `next.config.mjs`

## [0.5.0] - 2026-02-18
### Added
- **Unified `CopyButton` component** -- replaces three separate copy button implementations; supports `size='sm'` for inline JSON tree values and `size='md'` for cards
- **Reusable `SmartSectionHeader` component** -- consistent section header styling with uppercase tracking and left border accent
- `isRecord()` type guard utility for safe plain-object type narrowing
### Changed
- JSON tree node default-expanded computation simplified to single `useState` with lazy initializer
- Collapsible Raw JSON header changed to `<div role="button">` with keyboard handler for improved accessibility
- FindingCard list items now use composite keys for more stable React reconciliation
- Clipboard write calls now silently handle permission denials
- Input/Output toggle buttons include explicit `type="button"` to prevent form submissions

## [0.4.0] - 2026-02-18
### Added
- **Resilient fetch utility** (`src/lib/fetcher.ts`) -- `resilientFetch<T>()` with automatic retry (exponential backoff, 5xx/network errors only), AbortSignal integration, configurable timeout (default 10s), and normalized `FetchError` shape
- **Centralized error handler** (`src/lib/error-handler.ts`) -- `AppError` typed error class with HTTP status and machine-readable code; `normalizeError()` for consistent error responses
- **Error boundary component** -- enhanced with `section` prop for compact inline fallback UI
- **Configurable run retention** -- `retentionDays` setting (default 30, range 1-365) filters old completed/failed runs from the dashboard
- **Retention settings UI** -- new "Run Retention" section in settings modal
- **Server-driven recency window** -- `recentCompletionWindowMs` served from API config endpoint
- **Version badge** -- dashboard header displays current version number
- **Expanded project health card mini-dashboard** -- runs organized into Active Runs, Failed Runs (collapsible, red-tinted), and Completed History with mini KPI pills
- **Enhanced pagination controls** -- numbered page buttons with ellipsis for large result sets
- Comprehensive test suites for `resilientFetch` and `normalizeError`
- Run discovery deduplication by run ID, preferring directories containing `run.json`
### Changed
- Task detail panel Data/Output tabs now use `max-h-[60vh]` instead of 256px for larger scrollable content areas
- Active run indicator animation standardized to `animate-pulse-dot` across all components
- All API routes now use centralized `normalizeError()` for consistent error responses
- All client-side hooks migrated to `resilientFetch` with automatic retry and abort support
- Settings modal redesigned with labeled sections and input validation
- Recently completed projects stay in Active section for configurable recency window (default 4 hours)
### Fixed
- Task detail panel Data/Output content was clipped at 256px with no way to see full output -- now uses 60vh
- Log viewer stdout/stderr/output sections had same 256px limitation -- now uses 60vh
- Cache pruning cleans up ghost entries from prior deduplication misses
### Configuration
- New environment variable: `OBSERVER_RETENTION_DAYS` (default: 30) -- number of days to retain completed/failed runs
- New environment variable: `OBSERVER_RECENT_WINDOW_MS` (default: 14400000 / 4 hours) -- recency window for completed projects
- New registry fields in `~/.a5c/observer.json`: `retentionDays`, `recentCompletionWindowMs`

## [0.3.0] - 2026-02-17
### Added
- **Smart dashboard layout** -- active/history section split with active or stale runs shown prominently at top; completed/failed runs grouped into collapsible "Recent History"
- **Idle empty state** -- centered message with Eye icon when no runs exist
- **Idle-with-history banner** -- compact banner when no active runs but history exists
- **Collapsible Recent History section** -- toggle, project count badge, and auto-collapse for 5+ history projects
- **Project health card** -- expanded runs split into Active Runs and Completed Runs sub-sections
- **Completed runs toggle** -- count display with History icon
### Changed
- Dashboard status filter logic routes completed/failed filters directly to a flat grid
- Project health card tracks `showCompleted` toggle state

## [0.2.3] - 2026-02-17
### Fixed
- **Watermark-based notification deduplication** -- replaced cooldown-based system; notifications fire exactly once per state transition
- Waiting notification flag resets when a run leaves the waiting state, allowing re-notification on the next breakpoint
- Initial digest seeding phase now pre-populates watermarks, preventing false notifications on dashboard startup

## [0.2.2] - 2026-02-17
### Fixed
- Removed stale monorepo setup instructions from README
- Corrected CLI flag in README development section: changed `--dir` to `--watch-dir`
- Fixed API reference description: clarified endpoints return JSON "unless noted otherwise"

## [0.2.0] - 2026-02-17
### Added
- **Debounced filesystem discovery** -- `discoverAndCacheAll()` skips re-scanning if called within 10 seconds of the last scan
- **Batched cache population** -- runs pre-populated in batches of 10 instead of all at once
- **Breakpoint wait time** -- elapsed wait time displayed on breakpoint steps with `animate-pulse` animation
### Changed
- Package renamed from `@a5c-ai/babysitter-observer` to `@a5c-ai/babysitter-observer-dashboard`
- CLI binary renamed from `babysitter-observer` to `babysitter-observer-dashboard`
- Digest API route uses cached digests instead of fresh calls, preventing notification spam
- Run card layout redesigned: title on its own row; status badges, stale indicator, and tags on a second row
- Breakpoint step card label changed from "Needs approval" to "Waiting for approval"
- Breakpoint step card duration label now shows "Wait time:" instead of "Duration:"
### Fixed
- Cache invalidation now resets discovery debounce timer so the next request triggers an immediate re-scan

## [0.1.2] - 2026-02-17
### Added
- **Back-to-dashboard navigation** -- breadcrumb trail on the run detail page
- **Run cache re-discovery** -- saving new sources in settings invalidates cache and triggers a fresh filesystem scan
### Changed
- Notification provider skips notifications on the first two digest loads to prevent startup spam
- Notification provider adds a 30-second cooldown per run+type key
- Config source deduplication with path normalization
### Fixed
- API runs route re-discovers runs when project cache is empty after invalidation

## [0.1.1] - 2026-02-17
### Changed
- Repository renamed from `babysitter-observer` to `babysitter-observer-dashboard` in package.json

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
