# Release checklist — 0.14.0

Owner-executed commands, in order. **Nothing below has been run** — this branch only stages the release (version bump, CHANGELOG, notes). Run from `/home/yoavm/projects/babysitter-observer-standalone`.

## 0. Pre-flight (already verified on this branch)

- `package.json` / `package-lock.json` at `0.14.0`, CHANGELOG has the `[0.14.0]` section.
- `npm run -s lint && npx tsc --noEmit` clean.

## 1. Push the branch

```bash
git push origin feat/observer-kanban
```

## 2. Open and merge the PR to main

```bash
gh pr create --base main --head feat/observer-kanban \
  --title "Release 0.14.0: kanban triage board, one counting source, honest breakpoints & liveness" \
  --body-file RELEASE-NOTES-0.14.0.md

gh pr checks --watch        # CI = build + vitest on Node 20/22
gh pr merge --squash --subject "chore(release): v0.14.0"
```

**Why `--squash --subject` and not a regular merge commit:** `.github/workflows/auto-version.yml` skips auto-versioning only when the commit landing on `main` has a subject starting with `chore(release):` (`if: "!startsWith(github.event.head_commit.message, 'chore(release):')"`). A default merge commit's subject is `Merge pull request #N from ...`, which does not match — auto-version would then run, recompute the next version from the last tag, and mislabel this release as 0.13.0. Squash-merging with an explicit `--subject` guarantees the landed commit's subject matches the skip pattern exactly.

## 3. Confirm auto-version no-ops, then tag + publish manually

**Heads-up: merging to main triggers automation.** `auto-version.yml` runs on every push to `main`, but its `if:` skips any head commit whose subject starts with `chore(release):`. Since step 2 lands the squash-merge with subject exactly `chore(release): v0.14.0`, this should always skip — auto-version must **not** recompute a version or touch the CHANGELOG. Verify:

```bash
git checkout main && git pull
gh run list --workflow auto-version.yml --limit 1     # expect: skipped, OR completed with no new commit/tag
git log --oneline -3                                   # expect NO 'chore(release): v0.13.0 — auto-versioned' commit, NO v0.13.0 tag
grep '"version"' package.json                          # MUST read 0.14.0
```

**If auto-version still ran anyway** (e.g. the `--subject` flag was dropped or edited at merge time — recovery, precedent: 0.10.1 hit the duplicate-CHANGELOG variant of this):

```bash
git push origin :refs/tags/v0.13.0        # delete the bad remote tag before it publishes wrong
# Edit CHANGELOG.md: delete any duplicate auto-generated section, keep the hand-written [0.14.0] one.
git add CHANGELOG.md
git commit -m "chore: remove duplicate auto-generated CHANGELOG entry"
git push origin main
```

Because auto-version does not tag when it skips, tag and publish are manual:

```bash
git tag v0.14.0
git push origin v0.14.0                 # triggers publish.yml → npm publish (NPM_PUBLISH_TOKEN, no OTP)
gh run list --workflow publish.yml --limit 1
npm view @yoavmayer/babysitter-observer-dashboard version   # expect 0.14.0
```

**Fallback — manual publish** (only if the publish workflow fails; `prepublishOnly` runs `next build` + `build:cli`):

```bash
npm ci
npm publish --access public
# If your npm account requires 2FA for publish, append a fresh code:
#   npm publish --access public --otp=<6-digit-code>
```

## 4. CRITICAL — restart the live :4800 observer (currently 0.12.x)

The dashboard on :4800 is a long-lived npx process started as:

```
bash -c "npx -y @yoavmayer/babysitter-observer-dashboard@latest --port 4800 --watch-dir /home/yoavm/projects > /home/yoavm/.a5c/observer-4800.log 2>&1"
```

**Stop it** (kill the whole tree — bash wrapper, `npm exec`, and the node server):

```bash
ps aux | grep -E 'babysitter-observer-dashboard|@yoavmayer/babysitter-observer-dashboard' | grep -v grep
pkill -f '@yoavmayer/babysitter-observer-dashboard'
pkill -f 'babysitter-observer-dashboard --port 4800'
ss -ltnp | grep 4800   # must be empty before relaunch
```

**Relaunch from 0.14.0** — pin the version explicitly so a cached npx `@latest` can't serve 0.12.x:

```bash
nohup bash -c 'npx -y @yoavmayer/babysitter-observer-dashboard@0.14.0 --port 4800 --watch-dir /home/yoavm/projects > /home/yoavm/.a5c/observer-4800.log 2>&1' >/dev/null 2>&1 &
tail -f /home/yoavm/.a5c/observer-4800.log   # until "ready"; Ctrl-C to detach
```

- If Aikido Safe Chain blocks the fresh (<24h old) version with `ENOVERSIONS`, add `--safe-chain-skip-minimum-package-age` to the npx line (documented in README).
- **New merge semantics:** `--watch-dir /home/yoavm/projects` no longer replaces the persisted sources — everything in `~/.a5c/observer.json` **plus** `~/.a5c/runs` now also loads. Review what will appear first: `cat ~/.a5c/observer.json`. Seeing more projects/runs after restart is expected and correct.

## 5. Post-restart verification

```bash
curl -s http://localhost:4800/api/version
```

- [ ] `/api/version` and the footer show app `0.14.0` **and the real babysitter CLI version** (e.g. `6.0.2` — not `N/A`, not a stale `0.0.x`).
- [ ] The board opens with **four columns** (Needs you / Working / Stalled / Done), plus a **Scheduled** column when a run is waiting on a wake/schedule.
- [ ] A genuinely-live run (fresh journal activity) lands in **Working**, not Stalled or Orphaned.
- [ ] Answering a breakpoint from a card **records to disk** (`result.json` + one `EFFECT_RESOLVED`) and does **not** run the orchestrator; the card reflects a recorded, not-yet-applied state.
- [ ] The idle-session **"⚡ N sessions"** chip renders when bare session-start runs exist, is hidden by default, reveals on toggle, and its count reconciles with the runs it hides (no run with tasks or a breakpoint is ever counted as an idle session).
- [ ] Clicking a status pill (e.g. Waiting / Needs you / Orphaned) renders the **flat run list**, stale-first, with action hints.
- [ ] The **"N hidden"** chip is visible next to the filter pills (given hidden projects in Settings) and opens Settings.
- [ ] The **needs-you banner and count include hidden projects'** pending approvals (banner total = true total).
- [ ] Runs from **`~/.a5c/runs`** are visible alongside `/home/yoavm/projects` project runs (merge semantics working).
- [ ] Run cards show liveness chips (live / orphaned); run ages over 48h read in days (e.g. `16d 4h`).
