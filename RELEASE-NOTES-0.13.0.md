# Observer Dashboard 0.13.0 — Triage you can trust

0.13.0 is about honest triage: the dashboard now tells you which runs are actually being driven, which are waiting on *you*, and which were abandoned — and every badge, count, and label finally agrees with the list behind it.

## Highlights

- **Flat filtered run list.** Click a status pill and get a flat, cross-project list of exactly those runs — with action hints and stale-first ordering so the oldest stuck work is on top. New **"Needs you"** and **"Orphaned"** pills isolate runs waiting on a human and runs whose orchestrator died.
- **Liveness-aware, honest labels.** The observer reads `run.lock` + a pid probe (read-only — it never touches the process) and shows a live/orphaned chip per run. Runs blocked on a breakpoint say **"Waiting"** instead of "Running", and stale approvals say "(still waiting — driver attached)" when a driver really is attached — no more fake "(checking...)".
- **Counts that reconcile.** Needs-you / orphaned / waiting badges and the in-progress header use the same predicates as the lists they open.
- **Hiding a project no longer hides its alarms.** Hidden projects leave the grid and KPIs but stay in the needs-you banner, count, filter, and search — with an **"N hidden"** chip next to the pills that opens Settings.
- **`--watch-dir` merges, not replaces.** An explicit `--watch-dir` now merges with the sources saved via Settings (`~/.a5c/observer.json`), and `~/.a5c/runs` is always watched — restarting with a flag no longer silently drops your other sources.
- **Real version in the footer.** `/api/version` re-detects the babysitter CLI version (5-minute TTL + idle refresh), so long-lived dashboards reflect CLI upgrades.
- **No ghost runs.** Stray folders under a runs dir no longer render as fake "Unknown / 0 tasks" runs, human-named run ids stay readable, and ages over 48h display in days ("16d 4h").
- **Cleaner journal writes.** The approval path stamps `sdkVersion` on `EFFECT_RESOLVED` entries like SDK-native writes (verified against a real 6.0.2 entry). The dashboard's breakpoint card itself is now inform-only: see the decision, answer in the terminal.
- **Accessibility.** The flat list ships with proper list semantics, ARIA labels, and screen-reader announcements.

## Upgrade

```bash
npx -y @yoavmayer/babysitter-observer-dashboard@latest --port 4800
```

Note: after upgrading, an explicit `--watch-dir` also loads your persisted `~/.a5c/observer.json` sources (merge semantics) — you may see more projects and runs than before. That is the fix, not a bug.

Full details in [CHANGELOG.md](./CHANGELOG.md#0130---2026-07-03).
