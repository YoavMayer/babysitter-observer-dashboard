# @a5c-ai/babysitter-observer-dashboard — Alpha Release Milestone

> **Status:** In Progress
> **Target:** v0.1.0-alpha.0
> **Audit Score:** 58/100 (target: 85+)
> **Date:** 2026-02-17

---

## Audit Summary

Current state after 3 major development sessions (Feb 16-17):
- **Dashboard**: Full Next.js 14 observability dashboard with health cards, KPI metrics, pipeline visualization, event stream, breakpoint UI
- **Tests**: 500+ unit tests (Vitest + RTL + MSW), Playwright E2E setup with fixtures
- **Architecture**: Feature-first, SSE real-time, in-memory cache, multi-project support, CLI

### Critical Gaps (Score: 58/100)

| Dimension | Score | Priority | Key Issues |
|-----------|-------|----------|------------|
| Package Config | 25 | CRITICAL | `private: true`, no license, no metadata, no bin entry |
| Documentation | 45 | HIGH | README insufficient for SDK, no quick start, no CLI reference |
| Test Coverage | 55 | CRITICAL | Vitest version mismatch (v1.6.1 vs ^2.1.9), tests not verified |
| CLI Readiness | 60 | HIGH | No bin entry, no compiled JS, no --version, port inconsistency |
| Error Handling | 60 | HIGH | No error boundary, SSE reconnect issues, missing graceful degradation |
| Dashboard UX | 40 | CRITICAL | Stale runs inflate active count, no waiting type differentiation, card layout issues |
| Hardcoded Values | 65 | MEDIUM | Port 3001/3000 inconsistency, cwd assumptions |
| Build Health | 70 | HIGH | Not verified on current branch, no standalone output |
| Performance | 75 | MEDIUM | Unbounded cache, watcher accumulation, no bundle analysis |
| Dependencies | 80 | MEDIUM | Vitest version mismatch, no peer deps, Tailwind v4 early |
| Security | 85 | LOW | No CORS, no CSP (acceptable for alpha local-only) |

---

## Phase 0: New Standalone Public Repository

**Goal:** Extract the observer into its own standalone public GitHub repo

### Tasks:
- [ ] Create new public GitHub repo: `a5c-ai/babysitter-observer-dashboard`
- [ ] Initialize with proper .gitignore, LICENSE (MIT), .github/ templates
- [ ] Copy observer source from monorepo `packages/observer/` to new repo root
- [ ] Restructure paths (remove monorepo-specific `packages/observer/` nesting)
- [ ] Update all import paths and references
- [ ] Setup GitHub Actions CI/CD pipeline:
  - Lint + type-check on PR
  - Unit tests (Vitest) on PR
  - E2E tests (Playwright) on PR
  - Auto-publish to npm on tag/release
- [ ] Configure npm publishing:
  - `.npmrc` with `@a5c-ai` scope configuration
  - `npm publish --access public` in CI
  - Version from `package.json` (no lerna/changesets needed for single package)
- [ ] Add GitHub repo settings: branch protection, required reviews, status checks
- [ ] Setup Dependabot for dependency updates
- [ ] Add CONTRIBUTING.md with development guide
- [ ] Add CHANGELOG.md (initial entry)

---

## Phase 0.5: Dashboard UX Defects (Core Experience)

**Goal:** Fix critical UX issues that impact the core dashboard experience
**Priority:** CRITICAL — these affect data accuracy and user trust in the dashboard

### Stale Run Detection (CRITICAL)
- [ ] Add `isStale: boolean` field to Run and RunDigest types
- [ ] Implement staleness detection in `parser.ts`: runs with status "waiting"/"pending" and `updatedAt` older than threshold are marked stale
- [ ] Make stale threshold configurable (default: 1 hour / 3600000ms) via observer settings
- [ ] Update `ProjectSummary` to include `staleRuns` count
- [ ] `activeRuns` count MUST exclude stale runs (currently inflated — e.g., shows 13 active when only 2 terminals open)
- [ ] Sort order: truly active > stale > completed > failed
- [ ] Stale runs visually dimmed (reduced opacity, muted gray badge: "Stale (2h ago)")
- [ ] Landing page KPI: show accurate Active count + separate Stale indicator when > 0

### Waiting Status Differentiation (HIGH)
- [ ] Add `waitingKind: 'breakpoint' | 'task'` field to Run and RunDigest types
- [ ] `parser.ts`: extract waitingKind from the last requested task — if `kind === "breakpoint"` → "breakpoint", else → "task"
- [ ] `status-badge.tsx`: render sub-label "Waiting: Breakpoint" (Hand icon) or "Waiting: Task" (Loader icon)
- [ ] Include `waitingKind` in API digest responses for lightweight polling

### Project Health Card Layout (MEDIUM)
- [ ] Project title (name) on its own standalone full-width row at top
- [ ] Status badges, run counts, and metadata tags on a second row below the title
- [ ] Data content (run list, expand/collapse) follows below the status row

---

## Phase 1: Test Verification & Fixes

**Goal:** All unit tests pass reliably

### Tasks:
- [ ] Fix Vitest version mismatch — ensure `npx vitest run` uses the version from `package.json` (^2.1.9)
  - Check if monorepo root has an older vitest hoisted
  - Consider pinning exact version: `"vitest": "2.1.9"`
  - Run `npm ls vitest` to diagnose
- [ ] Run full test suite and capture results: `npx vitest run 2>&1`
- [ ] Fix any failing tests (do not delete tests, fix them):
  - Common issues: MSW handler mismatches, missing providers, async timing
  - Check test setup.ts mocks are complete
- [ ] Verify all 500+ tests pass with 0 failures
- [ ] Run coverage report: `npx vitest run --coverage`
- [ ] Target: >70% coverage for alpha, >85% for beta

---

## Phase 2: Package Hardening (Standalone SDK)

**Goal:** Package is publishable and installable from npm

### package.json Changes:
- [ ] `"private": false`
- [ ] `"version": "0.1.0-alpha.0"`
- [ ] `"description": "Real-time observability dashboard for babysitter orchestration runs"`
- [ ] `"license": "MIT"`
- [ ] `"engines": { "node": ">=18.0.0" }`
- [ ] `"repository": { "type": "git", "url": "https://github.com/a5c-ai/babysitter-observer-dashboard.git" }`
- [ ] `"homepage": "https://github.com/a5c-ai/babysitter-observer-dashboard#readme"`
- [ ] `"bugs": { "url": "https://github.com/a5c-ai/babysitter-observer-dashboard/issues" }`
- [ ] `"keywords": ["babysitter", "observer", "dashboard", "orchestration", "monitoring", "nextjs", "sse", "real-time"]`
- [ ] `"bin": { "babysitter-observer": "./dist/cli.js" }`
- [ ] `"files": ["dist", ".next/standalone", ".next/static", "public", "next.config.mjs", "package.json", "README.md", "LICENSE"]`

### CLI Hardening (src/cli.ts):
- [ ] Add `--version` flag that reads from package.json
- [ ] Fix port default inconsistency — standardize on 3000
- [ ] Fix `__dirname` resolution to work in both dev and installed contexts
- [ ] Ensure `execSync` for `next` resolves correctly when installed as npm package
- [ ] Add `npx` compatibility — `npx @a5c-ai/babysitter-observer-dashboard` should just work
- [ ] Build CLI to dist/cli.js with proper shebang

### Configuration:
- [ ] Standardize port default: 3000 everywhere (scripts, CLI, .env.example)
- [ ] Update .env.example with all documented variables
- [ ] Ensure zero-config works: auto-discovers `.a5c/runs` from cwd
- [ ] Add `OBSERVER_BASE_PATH` for sub-path mounting

### Next.js Standalone Build:
- [ ] Add `output: 'standalone'` to next.config.mjs for npm distribution
- [ ] Verify standalone server works independently
- [ ] Test `npx @a5c-ai/babysitter-observer-dashboard` from a fresh directory

---

## Phase 3: SDK README & Documentation

**Goal:** Comprehensive README that enables users to install and use the observer immediately

### README.md Sections:
- [ ] Title with npm/license/node version badges
- [ ] One-line description
- [ ] Screenshot placeholder
- [ ] Features list (10+ bullet points)
- [ ] Quick Start (3 steps: install → run → open)
- [ ] CLI Reference (all flags with examples)
- [ ] Configuration table (all env vars, defaults, descriptions)
- [ ] Architecture overview (how it works)
- [ ] API endpoints reference (for advanced users)
- [ ] Development guide (setup, run, test)
- [ ] Testing (unit + E2E commands)
- [ ] Known Limitations (alpha)
- [ ] Roadmap (alpha → beta → stable)
- [ ] License (MIT)

### Additional Docs:
- [ ] LICENSE file (MIT)
- [ ] CONTRIBUTING.md (development setup, PR process, code style)
- [ ] CHANGELOG.md (initial v0.1.0-alpha.0 entry)

---

## Phase 4: E2E Tests & Performance

**Goal:** Core user flows work end-to-end, no performance blockers

### E2E Tests (Playwright):
- [ ] Install Playwright browsers: `npx playwright install chromium`
- [ ] Verify fixture data in `e2e/fixtures/runs/`
- [ ] Run E2E suite: `npx playwright test`
- [ ] Fix failing E2E tests:
  - Dashboard loads with KPI tiles
  - Project cards display correctly
  - Run detail navigation works
  - Event stream renders
  - Settings modal opens/closes
- [ ] Add smoke test for CLI startup (if not already)

### Performance Validation:
- [ ] Build and check bundle size (target: < 2MB JS)
- [ ] Review run-cache.ts: add max entries limit
- [ ] Review watcher.ts: verify cleanup on directory removal
- [ ] Review SSE stream: verify connection cleanup on disconnect
- [ ] Review hooks: verify all useEffect cleanups are complete
- [ ] Test with 100+ runs to check scaling behavior

---

## Phase 5: Error Handling & Graceful Degradation

**Goal:** Observer doesn't crash under common edge cases

### Tasks:
- [ ] Add React Error Boundary around main app
- [ ] Handle missing `.a5c/runs` directory (show empty state, not crash)
- [ ] Handle corrupted journal files (skip, log warning)
- [ ] Handle SSE connection loss (reconnect with backoff)
- [ ] Handle API route errors with proper HTTP status codes
- [ ] Add loading states for all async operations
- [ ] Test with: empty directory, single run, many runs, corrupted journal

---

## Phase 6: Build & Integration Verification

**Goal:** Package builds cleanly and `npm pack` produces correct tarball

### Tasks:
- [ ] `npm run build` succeeds with 0 errors
- [ ] `npm pack --dry-run` shows correct file list
- [ ] Package size is reasonable (< 50MB tarball)
- [ ] Test files, node_modules, .env NOT included in tarball
- [ ] Essential files included: package.json, README, LICENSE, dist/, .next/
- [ ] `npm install @a5c-ai/babysitter-observer-dashboard` from tarball works
- [ ] `npx @a5c-ai/babysitter-observer-dashboard --help` works after install

---

## Phase 7: Quality Convergence

**Goal:** Achieve quality score >= 85/100

### Iterative Loop (max 3 iterations):
1. Run quality assessment across all dimensions
2. Fix highest-severity remaining issues
3. Re-verify build + tests
4. Re-assess quality
5. Repeat until score >= 85

### Quality Dimensions (weighted):
| Dimension | Weight | Target |
|-----------|--------|--------|
| Unit Tests | 20% | All pass, >70% coverage |
| E2E Tests | 15% | Core flows pass |
| Build | 15% | Clean build, reasonable size |
| Package Config | 15% | All metadata correct |
| Documentation | 15% | Comprehensive README |
| Performance | 10% | No blockers |
| Publish Readiness | 10% | npm pack clean |

---

## Phase 8: Final Review & Publish

**Goal:** Human approval + alpha release

### Tasks:
- [ ] Final quality score review
- [ ] Manual testing of dashboard (dev mode)
- [ ] Review all changes since milestone start
- [ ] Git commit all changes
- [ ] Create git tag: `v0.1.0-alpha.0`
- [ ] Push to new standalone repo
- [ ] Publish to npm: `npm publish --tag alpha --access public`
- [ ] Verify npm install works: `npx @a5c-ai/babysitter-observer-dashboard`
- [ ] Create GitHub release with changelog

---

## Success Criteria

- [ ] Quality score >= 85/100
- [ ] All unit tests pass (500+)
- [ ] E2E smoke tests pass
- [ ] `npm pack` produces clean tarball
- [ ] `npx @a5c-ai/babysitter-observer-dashboard --help` works
- [ ] README is comprehensive and accurate
- [ ] Package is public on npm as `@a5c-ai/babysitter-observer-dashboard@0.1.0-alpha.0`
- [ ] Standalone repo has CI/CD pipeline
- [ ] No crashes on common edge cases (empty dir, no runs, corrupted data)

---

## Dependencies & Notes

- **Node.js**: >=18.0.0 required
- **npm scope**: `@a5c-ai` (needs organization access)
- **WSL2**: I/O performance is slow for builds/tests — consider running on native Linux or Mac for CI
- **Vitest**: Version mismatch is the #1 blocker for test verification
- **Next.js standalone**: Required for `npx` distribution model
