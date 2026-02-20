# PDR: IDE-Integrated Dashboard Panel

**Product Design Review** | **Status:** Planning | **Author:** Claude Code | **Date:** 2026-02-20
**Version:** 0.2.0 | **Based on:** STAKEHOLDER-UX-REVIEW.md (v0.7.1) Next Features section

> **Design Principle:** The dashboard is an **observation-only (read-only) tool**. It uses only GET API calls to read run state. It does NOT write to babysitter runs or modify orchestration state. Any POST/PUT/DELETE routes that mutate babysitter run data are bugs.

---

## 1. Problem Statement

Users must open `localhost:3000` in a separate browser window every time they start the observer. This forces constant context-switching between terminal and browser. The dashboard should appear **alongside the terminal** regardless of which IDE, editor, or terminal app the user is running.

**Stakeholder context (from UX review):**
- Alex (28/100) cannot determine product purpose within 30 seconds -- the extra browser tab adds friction
- Marcus (77/100) wants keyboard-first UX but must mouse to the browser window
- Raj (74/100) praised npx one-liner setup but hit a wall at the empty state -- an IDE panel would keep the dashboard visible during the "aha moment"
- Nadia (38/100) needs the breakpoint status visible without leaving the IDE (dashboard is read-only by design -- approval happens externally via CLI/SDK)

---

## 2. Current State Audit

**Implementation status: NOTHING IMPLEMENTED.** Every item below has been verified against the codebase.

### 2.1 CLI (`src/cli.ts`)

Current flags:
```
--port <number>       Port to listen on (default: 3000)
--watch-dir <path>    Directory to watch for .a5c/runs
--poll-interval <ms>  Polling interval in milliseconds
--theme <dark|light>  Default UI theme
--dev                 Run in dev mode (next dev)
--version, -v         Show version
--help                Show help
```

**Missing:**
- No `--open` flag (no `auto` / `panel` / `browser` / `none` mode)
- No environment detection logic (no `VSCODE_*`, `TERM_PROGRAM`, `TMUX`, `SSH_CONNECTION`, etc.)
- No `open` or `xdg-open` or `start` call to auto-open browser
- After `next start`, the CLI prints the start message and blocks -- user must manually navigate to the URL

### 2.2 Dashboard App (Next.js)

- **Framework:** Next.js 14.2.35, React 18, Tailwind CSS 4
- **Pages:** 2 routes -- `/` (dashboard) and `/runs/[runId]` (run detail)
- **Layout:** Full-page app with `AppHeader` + `AppFooter` in `Providers`
- **Viewport assumptions:** `max-w-[1600px]` container, desktop-first, sticky header
- **SSE:** Real-time event stream via `/api/stream` endpoint
- **Config:** `~/.a5c/observer.json` file, loaded server-side
- **No VS Code extension** exists -- no `extension.ts`, no webview panel, no activity bar, no status bar item
- **No TUI mode** -- no `blessed`, `ink`, or terminal rendering code
- **No Tauri** -- no native companion window

### 2.3 UI Components Relevant to IDE Panel

| Component | Location | IDE Panel Consideration |
|-----------|----------|------------------------|
| `AppHeader` | `src/components/shared/app-header.tsx` | 150px+ height with SSE chip, bell, help, settings, theme toggle -- too tall for a narrow IDE panel |
| `AppFooter` | `src/components/shared/app-footer.tsx` | Version badges, links -- may need hiding in panel mode |
| `BreakpointPanel` | `src/components/breakpoint/breakpoint-panel.tsx` | Read-only by design -- displays breakpoint status (approval happens externally via CLI/SDK) |
| `BreakpointBanner` | `src/components/dashboard/breakpoint-banner.tsx` | Pulsing banner on dashboard -- good candidate for IDE panel status bar |
| `MetricTile` (KPI) | `src/app/page.tsx` (inline) | 5-column grid -- needs compact single-row layout for narrow panel |
| `ProjectHealthCard` | `src/components/dashboard/project-health-card.tsx` | Card grid layout -- needs vertical stack for panel |
| `RunDetailPage` | `src/app/runs/[runId]/page.tsx` | 3-panel layout (pipeline/detail/events) -- completely unusable in narrow panel |
| `GlobalSearch` | `src/components/dashboard/global-search.tsx` | Ctrl+K search -- would conflict with IDE's own Ctrl+K |
| `SettingsModal` | `src/components/shared/settings-modal.tsx` | Modal overlay -- works in webview but needs focus trapping fix first |
| `NotificationPanel` | `src/components/notifications/notification-panel.tsx` | Desktop popover -- needs rethinking for panel context |

### 2.4 Read-Only Design & Bug Audit

The dashboard is **intentionally a read-only observation tool**. Breakpoint approval/rejection happens externally via the babysitter CLI or SDK (e.g. `babysitter task:post` or the breakpoints tool). The dashboard only reads run state via GET calls.

**The breakpoint panel (`breakpoint-panel.tsx`) is correctly read-only:**
- Displays the breakpoint question clearly
- Shows "Awaiting decision" / "Decision made" status
- Shows attached files via `FilePreview`
- Shows "Approved" / resolved state when resolved externally
- No Approve/Reject buttons -- this is **by design**, not a bug

#### 2.4.1 BUG: POST Routes That Violate Read-Only Design

Two POST routes exist that should be audited against the read-only principle:

| Route | File | Called From | Verdict |
|-------|------|------------|---------|
| `POST /api/runs/[runId]/tasks/[effectId]/resolve` | `src/app/api/runs/[runId]/tasks/[effectId]/resolve/route.ts` | **Nothing** -- dead code | **BUG.** This route writes `result.json` into the run directory via `babysitter task:post` CLI. It mutates babysitter run state. No UI component calls it. Should be **removed**. |
| `POST /api/config` | `src/app/api/config/route.ts` | `settings-modal.tsx:167`, `project-health-card.tsx:103` | **Acceptable.** Writes to `~/.a5c/observer.json` (dashboard's own config, NOT babysitter run data). Only modifies the dashboard's observation settings (watch sources, poll interval, theme, hidden projects) -- how the dashboard observes, not what it observes. This is dashboard self-configuration, not run mutation. |

#### 2.4.2 Dead Code Related to Write Operations

| File | Description | Verdict |
|------|-------------|---------|
| `src/hooks/use-breakpoint-resolve.ts` | Hook that POSTs to the resolve route. Has 13 unit tests. Never imported by any component. | **Dead code.** Remove along with the resolve route. |
| `src/hooks/__tests__/use-breakpoint-resolve.test.ts` | 13 tests for the dead hook (7 currently failing). | **Dead code.** Remove along with the hook. |
| `src/types/breakpoint.ts` | Types for `BreakpointResolveRequest`/`BreakpointResolveResponse`. | Check if used elsewhere; may be dead code. |

#### 2.4.3 Implications for IDE Panel

Since the dashboard is read-only, the IDE panel will also be read-only. Users will:
1. **See** breakpoint status in the IDE panel (waiting, approved, rejected)
2. **Approve/Reject** via the babysitter CLI in their terminal (the terminal is already open beside the panel)
3. **See the update** reflected in the IDE panel in real-time via SSE

This actually simplifies the IDE panel implementation -- no write operations, no confirmation dialogs, no error handling for mutations. The panel is purely an observation window.

---

## 3. Phased Implementation Plan

### Phase 1: Smart `--open` Behavior (CLI-only, Low Effort)

**Goal:** Auto-open the dashboard in the best available surface after server starts.

#### 3.1.1 Changes to `src/cli.ts`

**New flag:**
```
--open <mode>   How to open the dashboard (default: auto)
                auto    — detect environment and pick best method
                panel   — force IDE panel (fail gracefully if not in IDE)
                browser — always open in default browser
                none    — just print URL, don't open anything
```

**New `CliOptions` field:**
```typescript
interface CliOptions {
  // ... existing fields ...
  open?: "auto" | "panel" | "browser" | "none";
}
```

**New environment detection function** (new file: `src/env-detect.ts`):

| Env Var / Signal | Environment | Auto Behavior |
|------------------|-------------|---------------|
| `VSCODE_*` or `TERM_PROGRAM=vscode` | VS Code / forks | `code --open-url "vscode://simpleBrowser/show?url=http://localhost:{port}"` |
| `CURSOR_*` | Cursor | Same as VS Code (Cursor supports Simple Browser) |
| `JETBRAINS_IDE` or `IDEA_INITIAL_DIRECTORY` | JetBrains IDEs | Open in JetBrains built-in browser tool window |
| `TMUX` | tmux session | Print URL + tip: `tmux split-window -h` |
| `SSH_CONNECTION` or `SSH_TTY` | Remote SSH | Print URL + port-forwarding instructions |
| `CODESPACES` or `GITPOD_*` | Cloud IDE | Use forwarded port URL |
| `WT_SESSION` | Windows Terminal | Open in default browser |
| `TERM_PROGRAM=iTerm.app` | iTerm2 | Open in default browser |
| `TERM_PROGRAM=WarpTerminal` | Warp | Open in default browser |
| None of the above | Unknown | Open in default browser |

**New `openDashboard` function** (new file: `src/open.ts`):
- Uses `child_process.exec` to run the appropriate open command
- Cross-platform: `open` (macOS), `xdg-open` (Linux), `start` (Windows)
- For VS Code: `code --open-url "vscode://simpleBrowser/show?url=..."`
- Non-blocking -- fire-and-forget after server is ready

**CLI flow change in `main()`:**
```
1. Parse args (existing)
2. Set env vars (existing)
3. Detect environment (NEW)
4. Print startup message with environment-specific tips (MODIFIED)
5. Start next server (existing -- but change from execSync to spawn)
6. Wait for server ready (NEW -- poll localhost:{port} or parse stdout)
7. Open dashboard based on --open mode (NEW)
8. Keep process alive (existing)
```

**Critical change:** The CLI currently uses `execSync` which blocks. To open the browser after the server starts, we need to switch to `child_process.spawn` and detect when the server is ready (listen for "Ready" in stdout or poll the port).

#### 3.1.2 New Files

| File | Purpose |
|------|---------|
| `src/env-detect.ts` | Detect terminal/IDE environment from env vars |
| `src/open.ts` | Open dashboard in browser/panel based on detection |

#### 3.1.3 Modified Files

| File | Changes |
|------|---------|
| `src/cli.ts` | Add `--open` flag parsing, switch `execSync` to `spawn`, call `openDashboard` after server ready |

#### 3.1.4 Config Persistence

Add `openMode` to `ObserverConfig` in `src/lib/config.ts` so users can persist their preference in `~/.a5c/observer.json`:

```json
{
  "sources": [...],
  "openMode": "auto"
}
```

CLI flag `--open` overrides the persisted config.

**New `CliOptions` field in config:**
```typescript
interface ObserverConfig {
  // ... existing fields ...
  openMode?: "auto" | "panel" | "browser" | "none";
}
```

---

### Phase 2: Lightweight VS Code Extension (Post-Alpha, Medium Effort)

**Goal:** Native VS Code sidebar with webview panel embedding the dashboard.

#### 3.2.1 New Directory Structure

```
vscode-extension/
  package.json           # Extension manifest
  tsconfig.json
  src/
    extension.ts         # Activation, commands, webview provider
    sidebar-provider.ts  # WebviewViewProvider for sidebar panel
    status-bar.ts        # Status bar item (run count + breakpoint count)
    server-manager.ts    # Start/stop observer server lifecycle
  media/
    icon.svg             # Activity bar icon
    sidebar.css          # Webview styles
  .vsixignore
```

#### 3.2.2 Extension Capabilities

| Feature | Implementation | VS Code API |
|---------|----------------|-------------|
| Activity bar icon | `contributes.viewsContainers` | `vscode.window.registerWebviewViewProvider` |
| Webview panel | `WebviewViewProvider` embedding `localhost:{port}` | `vscode.WebviewView` |
| Auto-start server | Detect `.a5c/` in workspace, start observer | `vscode.workspace.onDidChangeWorkspaceFolders` |
| Auto-stop server | Kill server process on deactivate | `context.subscriptions` cleanup |
| Status bar item | `{runCount} runs | {bpCount} BP` | `vscode.window.createStatusBarItem` |
| Commands | "Observer: Open Dashboard", "Observer: Focus Breakpoints" | `vscode.commands.registerCommand` |
| Notifications | Breakpoint waiting as VS Code notification | `vscode.window.showWarningMessage` |

#### 3.2.3 UI/UX Changes Required for Webview Embedding

The current dashboard is designed for a 1600px browser window. Embedding in a VS Code sidebar (typically 300-400px wide) requires significant layout changes:

**Dashboard page (`src/app/page.tsx`):**

| Current | Panel Mode | Change Description |
|---------|------------|-------------------|
| KPI tiles: 5-column grid | Single column vertical stack | CSS media query or viewport-aware layout. Each tile becomes a compact horizontal bar: `[icon] 5 Active` |
| `max-w-[1600px]` container | Full-width, no max | Remove max-width constraint when in panel mode |
| `px-6 py-6` padding | `px-2 py-2` | Reduce padding for narrow viewport |
| GlobalSearch with Ctrl+K | Search with `/` or inline filter | Ctrl+K conflicts with VS Code's command palette |
| Filter pills row | Compact dropdown or icon-only filters | Horizontal filter row overflows at 300px |
| ProjectHealthCard grid (3-col) | Single-column list | Cards stack vertically, simplified layout |
| Sort toggle | Compact icon button | Text label hidden |
| BreakpointBanner full-width | Compact alert bar | Shorter text, smaller glow |

**Run detail page (`src/app/runs/[runId]/page.tsx`):**

| Current | Panel Mode | Change Description |
|---------|------------|-------------------|
| 3-panel layout (pipeline/detail/events) | Tab-based single panel | **Major rework.** The 3 panels CANNOT fit in 300px width. Must switch to tabs or accordion. This is the same mobile panel switcher requested by Zara (Z1, Critical) |
| Navigation breadcrumb bar | Back button only | Breadcrumb overflows |
| MetricsRow horizontal | Compact 2x2 grid or hidden | Same as mobile issue (M14) |
| OutcomeBanner | Compact status line | Reduce to single-line |

**AppHeader (`src/components/shared/app-header.tsx`):**

| Current | Panel Mode | Change Description |
|---------|------------|-------------------|
| Full header with logo, links, SSE chip, 4 buttons | Minimal: SSE dot + settings gear only | Most header elements redundant in IDE context (logo, GitHub link, help, theme toggle handled by VS Code) |
| Sticky top-0 | Still sticky but shorter (32px vs 48px) | Maximize content area |

**AppFooter (`src/components/shared/app-footer.tsx`):**

| Current | Panel Mode | Change Description |
|---------|------------|-------------------|
| Footer with version badges | Hidden entirely | Footer wastes precious vertical space in panel |

**New: Panel Mode Detection**

Add a mechanism for the dashboard to detect it's running in a VS Code webview panel:

Option A: **URL parameter** -- Extension loads `localhost:3000?mode=panel`
Option B: **postMessage API** -- Extension sends `{ type: "panel-mode" }` to webview
Option C: **CSS media query** -- `@media (max-width: 500px)` (simpler but less precise)

**Recommendation:** Use both Option A (for server-side layout decisions) and Option C (for responsive CSS). The URL parameter `?mode=panel` is read by Next.js to conditionally render compact layouts, while CSS handles the responsive details.

**New component or layout variant:**
```
src/components/layouts/
  panel-layout.tsx      # Compact layout wrapper for IDE panel mode
  browser-layout.tsx    # Current full layout (rename from default)
```

Or simpler: a `usePanelMode()` hook that reads `?mode=panel` from the URL and returns layout flags.

#### 3.2.4 Keyboard Shortcut Conflicts

Current shortcuts that conflict with VS Code defaults:

| Shortcut | Dashboard Use | VS Code Use | Resolution |
|----------|---------------|-------------|------------|
| `Ctrl+K` | Global search | Command palette | Remap to `/` in panel mode |
| `n` | Toggle notifications | Typing in editor | Only active when webview is focused |
| `j` / `k` | Navigate items | Typing in editor | Only active when webview is focused (webview captures keys when focused) |
| `1-5` | Switch tabs | Typing in editor | Same -- webview focus isolation |
| `Escape` | Go back / close | Close panel | Needs careful handling -- should close detail view first, then deactivate on second press |

**Note:** VS Code webviews have their own focus context. Keyboard shortcuts only fire when the webview has focus, so most conflicts are naturally resolved. The exception is `Ctrl+K` which VS Code intercepts globally.

#### 3.2.5 Breakpoint Notification Integration

The extension should bridge dashboard breakpoint events to VS Code native notifications (read-only -- informational only):

```typescript
// In extension.ts -- poll the observer API for breakpoints
const response = await fetch(`http://localhost:${port}/api/runs`);
// If any run has a waiting breakpoint:
vscode.window.showWarningMessage(
  `Breakpoint waiting in run ${runId}: "${question}"`,
  "View in Dashboard"
);
```

The notification is read-only (no Approve/Reject actions in VS Code). Users approve via the babysitter CLI in their terminal. The dashboard and IDE panel reflect the updated state in real-time via SSE.

---

### Phase 3: Universal Companion Mode (Future, High Effort)

Three options evaluated. **Recommended: Phase 3B (TUI mode)** for universal coverage.

#### 3.3A: Tauri Native Sidebar

- ~5MB native window floating alongside any terminal
- Cross-platform (Windows, macOS, Linux)
- Docks to screen edge
- Always-on-top option
- **Effort: HIGH** -- separate build pipeline, platform-specific packaging, new dependency (Rust toolchain)
- **Recommendation: DEFER** -- not justified until user base is large enough

#### 3.3B: Terminal UI (TUI) Mode

**New flag:** `babysitter-observer-dashboard --tui`

- Renders a terminal-based dashboard using `ink` (React for CLIs) or `blessed`
- Works in ANY terminal including SSH and tmux
- Reduced feature set but universal
- Reuses existing hooks and data-fetching logic (API client)

**New files:**
```
src/tui/
  index.tsx          # TUI entry point
  app.tsx            # Main TUI app component
  kpi-bar.tsx        # Compact KPI metrics
  run-list.tsx       # Project/run list
  breakpoint-card.tsx # Breakpoint with Approve/Reject
  status-line.tsx    # Bottom status bar
```

**TUI layout (80-column terminal):**
```
+-- Observer Dashboard ---- localhost:3000 --+
| Runs: 5 active | 2 waiting | 12 completed |
|                                            |
| [!] BREAKPOINT WAITING                     |
|     my-project > run-abc123                |
|     "Approve deployment to staging?"       |
|     (approve via CLI: babysitter task:post)|
|                                            |
| Projects:                                 |
|   my-project      Healthy   3 runs        |
|   api-service     Active    2 runs        |
|                                            |
| Events:                                   |
|   14:32 EFFECT_RESOLVED scorer ok         |
|   14:31 EFFECT_REQUESTED build            |
+--------------------------------------------+
```

**Effort: MEDIUM** -- `ink` is well-established, can share data-fetching with main app. Read-only by design.

#### 3.3C: OS Window Management

- AppleScript (macOS), PowerShell (Windows), wmctrl (Linux) to tile browser + terminal
- **Effort: LOW but FRAGILE** -- breaks with different window managers, DPI settings, multi-monitor

**Recommendation: Skip** -- too fragile for a shipping product.

---

## 4. UI/UX Design Specifications

### 4.1 Panel Mode Layout -- Dashboard

```
+------- 350px panel -------+
| [SSE dot] Observer  [gear]|  <- 32px compact header
+----------------------------+
| 5 Active  2 Wait  12 Done |  <- Single-row KPI summary
+----------------------------+
| [!] BREAKPOINT WAITING     |  <- Compact breakpoint alert
| "Approve staging deploy?"  |     (read-only status display)
| run-abc12 · my-project     |  <- Link to run detail view
+----------------------------+
| my-project          3 runs |  <- Simplified project list
|   [====----] 75% tasks     |  <- Progress bar
|   run-abc12  Active  2m    |  <- Compact run row
|   run-def34  Done    5m    |
+----------------------------+
| api-service         2 runs |
|   [==========] 100% tasks  |
|   run-ghi56  Done    12m   |
+----------------------------+
```

### 4.2 Panel Mode Layout -- Run Detail

```
+------- 350px panel -------+
| [<] run-abc123    Active   |  <- Back button + run ID + status
+----------------------------+
| Tasks: 8/12  BP: 1 wait   |  <- Compact metrics
+----------------------------+
| [Pipeline] [Events] [BP]  |  <- Tab bar (replaces 3-panel)
+----------------------------+
| Pipeline tab content:      |
|  [ok] scorer       2.3s   |
|  [ok] builder      5.1s   |
|  [!!] approval     WAIT   |  <- Click to switch to BP tab
|  [ ] deployer      --     |
+----------------------------+
```

### 4.3 Panel Mode -- Responsive Breakpoints

| Width | Layout |
|-------|--------|
| < 400px | Panel mode: single column, compact header, tab navigation |
| 400-768px | Tablet/mobile: 2-column KPI grid, simplified cards |
| 768-1200px | Standard: current layout |
| > 1200px | Wide: current layout with max-w-[1600px] |

### 4.4 Panel Mode -- Color/Theme

- Inherit VS Code theme via CSS variables injected by the extension
- Dark theme: match VS Code's dark theme (current cyberpunk theme is close)
- Light theme: match VS Code's light theme (existing light theme)
- The webview `<html>` receives VS Code's `vscode-dark` / `vscode-light` / `vscode-high-contrast` body class

---

## 5. Dependencies and Blockers

### 5.1 Hard Blockers (Must Fix Before Any Phase)

| Blocker | Phase Affected | Effort | Reference |
|---------|---------------|--------|-----------|
| **CLI uses `execSync` -- blocks the process** | Phase 1 | S (2-4 hours) | `src/cli.ts:254` -- must switch to `spawn` to detect server ready and then open |

### 5.2 Bugs to Fix (Read-Only Design Violations)

These should be fixed as cleanup, ideally before the IDE panel ships to keep the codebase clean:

| Bug | Effort | Action |
|-----|--------|--------|
| `POST /api/runs/[runId]/tasks/[effectId]/resolve` route exists | S (30 min) | **Remove** `src/app/api/runs/[runId]/tasks/[effectId]/resolve/route.ts` -- dead code that mutates babysitter run state |
| `useBreakpointResolve` hook exists but is never used | S (30 min) | **Remove** `src/hooks/use-breakpoint-resolve.ts` and its 13 tests in `src/hooks/__tests__/use-breakpoint-resolve.test.ts` |
| `BreakpointResolveRequest` / `BreakpointResolveResponse` types | S (10 min) | **Remove** from `src/types/breakpoint.ts` if not used elsewhere |

### 5.3 Soft Blockers (Should Fix For Quality)

| Issue | Phase Affected | Effort | Reference |
|-------|---------------|--------|-----------|
| Modal focus trapping missing | Phase 2 (webview modals) | M (2-3 days) | Critical #5 |
| Mobile panel switcher missing | Phase 2 (panel reuses mobile layout) | M (2-3 days) | Critical #9 |
| Ctrl+K conflicts with VS Code | Phase 2 | S (30 min) | Remap to `/` in panel mode |
| 42 failing unit tests | All phases | M (1-2 days) | Critical #1 |

### 5.4 Shared Work (Benefits Both Panel and Mobile)

The panel mode layout (< 400px) and mobile layout (< 768px) share almost identical requirements:

| Requirement | Panel | Mobile | Status |
|-------------|-------|--------|--------|
| Single-column project list | Yes | Yes | TODO |
| Tab-based run detail (replace 3-panel) | Yes | Yes | TODO (Zara Z1) |
| Compact header | Yes | Yes | TODO |
| Compact KPI row | Yes | Yes | TODO |
| Touch/click targets 44x44px | N/A | Yes | TODO |
| Hide footer | Yes | Partial | TODO |

**Recommendation:** Build the responsive/panel-mode layout ONCE and use it for both mobile and IDE panel. This resolves Zara's #1 critical finding (mobile panel switcher) simultaneously.

---

## 6. Implementation Order

```
[Cleanup] Remove dead write-path code (resolve route, useBreakpointResolve hook)
    |
    v
[Phase 1] Smart --open flag (CLI-only)
    |  - src/env-detect.ts (new)
    |  - src/open.ts (new)
    |  - src/cli.ts (modify: add flag, spawn, open)
    |  - src/lib/config.ts (modify: add openMode)
    |
    v
[Shared] Responsive panel-mode layout
    |  - usePanelMode() hook
    |  - Compact header variant
    |  - Single-column dashboard layout
    |  - Tab-based run detail (replaces 3-panel for narrow views)
    |  - Also fixes mobile (Zara Z1)
    |
    v
[Phase 2] VS Code Extension
    |  - vscode-extension/ directory
    |  - WebviewViewProvider with localhost embedding
    |  - Server lifecycle management
    |  - Status bar item
    |  - Native breakpoint status notifications (read-only -- "BP waiting in run X")
    |
    v
[Phase 3B] TUI Mode (optional, future)
    - src/tui/ directory
    - ink-based terminal dashboard
    - Read-only breakpoint status display
```

---

## 7. Files Changed Summary

### Phase 1 (Smart `--open`)

| Action | File | Description |
|--------|------|-------------|
| **Create** | `src/env-detect.ts` | Environment detection (VS Code, tmux, SSH, etc.) |
| **Create** | `src/open.ts` | Cross-platform open logic (browser, VS Code panel, etc.) |
| **Modify** | `src/cli.ts` | Add `--open` flag, switch `execSync` to `spawn`, call open after ready |
| **Modify** | `src/lib/config.ts` | Add `openMode` to `ObserverConfig` and `RegistryData` |

### Cleanup (Dead Write-Path Code)

| Action | File | Description |
|--------|------|-------------|
| **Remove** | `src/app/api/runs/[runId]/tasks/[effectId]/resolve/route.ts` | Dead POST route that mutates babysitter run state -- violates read-only design |
| **Remove** | `src/hooks/use-breakpoint-resolve.ts` | Dead hook (never imported by any component) |
| **Remove** | `src/hooks/__tests__/use-breakpoint-resolve.test.ts` | 13 tests for dead hook (7 currently failing -- these are 7 of the 42 failing tests!) |
| **Audit** | `src/types/breakpoint.ts` | Remove `BreakpointResolveRequest` / `BreakpointResolveResponse` types if unused elsewhere |

### Shared (Panel Mode Layout)

| Action | File | Description |
|--------|------|-------------|
| **Create** | `src/hooks/use-panel-mode.ts` | Hook to detect `?mode=panel` or narrow viewport |
| **Modify** | `src/app/page.tsx` | Conditional compact layout for panel mode |
| **Modify** | `src/app/runs/[runId]/page.tsx` | Tab-based navigation replacing 3-panel layout in narrow views |
| **Modify** | `src/components/shared/app-header.tsx` | Compact header variant (hide logo, links; show SSE dot + gear only) |
| **Modify** | `src/components/shared/app-footer.tsx` | Hide footer in panel mode |
| **Modify** | `src/components/dashboard/global-search.tsx` | Remap Ctrl+K to `/` in panel mode |
| **Modify** | `src/components/dashboard/breakpoint-banner.tsx` | Compact variant for narrow width |

### Phase 2 (VS Code Extension)

| Action | File | Description |
|--------|------|-------------|
| **Create** | `vscode-extension/package.json` | Extension manifest |
| **Create** | `vscode-extension/tsconfig.json` | TypeScript config |
| **Create** | `vscode-extension/src/extension.ts` | Activation, commands |
| **Create** | `vscode-extension/src/sidebar-provider.ts` | WebviewViewProvider |
| **Create** | `vscode-extension/src/status-bar.ts` | Status bar (run count + BP) |
| **Create** | `vscode-extension/src/server-manager.ts` | Start/stop observer server |
| **Create** | `vscode-extension/media/icon.svg` | Activity bar icon |

### Phase 3B (TUI Mode)

| Action | File | Description |
|--------|------|-------------|
| **Create** | `src/tui/index.tsx` | TUI entry point |
| **Create** | `src/tui/app.tsx` | Main TUI layout |
| **Create** | `src/tui/kpi-bar.tsx` | KPI metrics bar |
| **Create** | `src/tui/run-list.tsx` | Run list component |
| **Create** | `src/tui/breakpoint-card.tsx` | Read-only breakpoint status display |
| **Modify** | `src/cli.ts` | Add `--tui` flag |
| **Modify** | `package.json` | Add `ink` dependency |

---

## 8. Effort Estimates

| Phase | New Files | Modified/Removed Files | Effort | Dependencies |
|-------|-----------|------------------------|--------|--------------|
| Cleanup: Remove dead write-path code | 0 | 3-4 removed | 1-2 hours | None. Also fixes 7 of the 42 failing tests. |
| Phase 1: Smart `--open` | 2 | 2 modified | 2-3 days | Cleanup done first |
| Shared: Panel-mode layout | 1 | 5-6 modified | 3-5 days | Also resolves mobile (Zara Z1) |
| Phase 2: VS Code Extension | 6 | 0 | 5-7 days | Panel-mode layout must be done first |
| Phase 3B: TUI mode | 5 | 2 modified | 3-5 days | Independent of Phase 2 |
| **Total** | **14** | **12-14** | **13-20 days** | |

---

## 9. Open Questions

1. **Should `--open=auto` be the default?** Current behavior is "print URL, don't open anything." Changing the default is a breaking change for scripts that parse CLI output.

2. **VS Code extension -- standalone or bundled?** Should it be a standalone `babysitter-observer` extension or part of a broader `babysitter` extension that also handles breakpoint creation?

3. **Webview vs Simple Browser?** Simple Browser is zero-code (just a URI scheme) but offers no customization. A native Webview panel can inject CSS, intercept messages, and integrate with VS Code API but requires building/publishing an extension.

4. **Should the panel mode be a separate Next.js layout route (`/panel/...`) or a query parameter (`?mode=panel`)?** A separate route is cleaner but requires maintaining two route trees. A query parameter is simpler but less SEO-friendly (irrelevant for a local tool).

5. **Config persistence for `--open`:** Should `openMode` be persisted in `~/.a5c/observer.json` so users don't need to pass the flag every time?

6. **TUI mode value:** Is the TUI mode valuable enough to justify the development cost, or do most terminal-only users prefer the browser? Survey needed.

7. **Port forwarding for Codespaces/Gitpod:** Should we auto-detect the forwarded port URL and open that instead of localhost?

---

## 10. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| VS Code Simple Browser URI scheme changes | Low | Medium | Fall back to default browser |
| Webview CSP blocks localhost fetch | Medium | High | Configure webview CSP to allow localhost |
| `execSync` to `spawn` migration breaks CI | Low | High | Comprehensive CLI tests |
| Panel-mode CSS breaks desktop layout | Medium | High | Use CSS custom properties + media queries, test both layouts |
| Keyboard shortcut conflicts in webview | Medium | Medium | Webview focus isolation + remap Ctrl+K |
| Extension marketplace review delays | Low | Medium | Publish early, iterate |

---

## 11. Success Metrics

| Metric | Current | Target (Phase 1) | Target (Phase 2) |
|--------|---------|-------------------|-------------------|
| Time from `npx` to dashboard visible | Manual (open browser, type URL) | Auto-open in 3s | 0s (auto-start with workspace) |
| Context switches to check breakpoint status | 2+ (terminal -> browser -> back) | 1 (browser auto-opens) | 0 (visible in IDE panel alongside terminal) |
| Environments with auto-open support | 0 | 8+ (VS Code, Cursor, Windsurf, tmux, SSH, etc.) | Same + native panel |
| User satisfaction (Alex persona) | 28/100 | 40+ | 55+ |

---

*This PDR is a planning document. No code changes have been made. The dashboard is read-only by design -- breakpoint approval happens externally via the babysitter CLI/SDK. Implementation can begin with the dead-code cleanup (removing the resolve POST route and unused hook), followed by Phase 1 (smart `--open` flag).*
