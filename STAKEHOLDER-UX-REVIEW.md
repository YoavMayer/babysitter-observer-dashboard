# Stakeholder Panel UX Review Report
## Babysitter Observer Dashboard

**Date:** 2026-02-18 | **Personas:** 8 | **Total Findings:** 151 | **Debate Convergence:** 87%

### Implementation Status Tracker

> **Legend:** DONE = fully implemented | PARTIAL = partially implemented | TODO = not started
>
> **v0.6.0** (2026-02-18) — Defect fixes, WCAG typography/contrast, performance overhaul
> **v0.6.0+cherry-pick** (2026-02-18) — Shared AppHeader/AppFooter, ARIA toasts, prefers-reduced-motion, SVG favicon
>
> | Section | DONE | PARTIAL | TODO | Total |
> |---------|------|---------|------|-------|
> | Critical Changes | 2 | 1 | 6 | 9 |
> | Important Changes | 2 | 2 | 6 | 10 |
> | Nice-to-Have | 0 | 0 | 6 | 6 |
> | Quick Wins | 3 | 2 | 2 | 7 |
> | WCAG Violations | 2 | 1 | 6 | 9 |
> | **Totals** | **9** | **6** | **26** | **41** |

---

## Executive Summary

A panel of 8 diverse stakeholders — ranging from a blind screen reader user to a 68-year-old professor to a Gen-Z intern — reviewed the Babysitter Observer Dashboard. The review surfaced **151 findings** across **15 themes**, with **9 critical changes**, **10 important improvements**, and **6 nice-to-have enhancements**.

The dashboard's core architecture is strong: the neon cyberpunk design system is praised by 6 of 8 personas, keyboard shortcuts in run detail are excellent, and the SSE real-time update system works reliably. However, the tool is currently **inaccessible to non-developers** and **functionally unusable for screen reader users** (James scored it 38/100). Three critical gaps block broad adoption: (1) missing ARIA accessibility attributes throughout, (2) 73 instances of sub-12px text that are physically unreadable for elderly and low-vision users, and (3) developer jargon ('breakpoint', 'stale', 'effectId') that intimidates non-technical users to the point where Sarah (PM) said she was 'afraid to click Respond.'

The recommended first steps are the **7 Quick Wins** (all Small effort): add a notification bell icon, add aria-live regions, add a visible '?' shortcut button, enlarge the SSE indicator, add icons to color-only badges, add prefers-reduced-motion CSS, and make MetricsRow responsive. These changes alone would dramatically improve the experience for 7 of 8 personas.

---

## Stakeholder Panel

| # | Persona | Age | Role | Tech Level | Score | Top Priority |
|---|---------|-----|------|-----------|-------|--------------|
| 1 | **Marcus** | 38 | Senior Developer | 9/10 | 82/100 | Dashboard keyboard navigation |
| 2 | **Sarah** | 42 | Project Manager | 3/10 | 52/100 | Jargon makes her afraid to interact |
| 3 | **Robert** | 68 | Ethics Consultant | 4/10 | 52/100 | Cannot physically read 10px text |
| 4 | **Zara** | 20 | CS Intern | 6/10 | 72/100 | Run detail unusable on mobile |
| 5 | **Diana** | 52 | CTO | 5/10 | 72/100 | No 30-second status overview |
| 6 | **James** | 35 | Blind Developer | 8/10 | 38/100 | Dashboard functionally unusable with screen reader |
| 7 | **Yuki** | 29 | Japanese Developer | 7/10 | 58/100 | English idioms and abbreviations confuse |
| 8 | **Alex** | 31 | DevOps Engineer | 7/10 | 52/100 | Spent 5 minutes confused about what app does |

---

## Key Findings by Theme

### [P0] Accessibility — ARIA & Screen Reader (8/8 personas)
The most critical theme. James (blind) identified 5 distinct blockers: no focus trapping in modals, silent toast notifications, no aria-pressed on filter pills, no landmark roles, no aria-live regions. **The breakpoint banner — the most time-sensitive information — is invisible to screen readers.**

### [P0] Typography & Contrast (7/8 personas)
73 instances of 10px text across 21+ component files. Robert demonstrated this renders at 7 physical pixels on his 1080p monitor at 150% scaling. The 'Awaiting decision' label for breakpoint approval — the most consequential action — is at 10px. Muted text with opacity modifiers fails WCAG AA contrast (approximately 2.8:1).

### [P0] Terminology & Jargon (7/8 personas)
Sarah's 'breakpoint fear' was the debate's pivotal moment: 'I am afraid to click Respond because I do not know what I am approving.' 4+ inconsistent phrasings for the same concept. 'Stale' causes anxiety. stdout/stderr meaningless to non-developers. Developer IDs (effectId, stepId) displayed prominently with no explanation.

### [P0] Mobile Responsiveness (6/8 personas)
Run detail page completely unusable on mobile — three full-height panels stack with no switcher. Touch targets as small as 14x14px (notification dismiss). Breakpoint approval — the most critical action — impossible on mobile.

### [P1] Discoverability (7/8 personas)
6 of 8 personas could not find keyboard shortcuts (hidden behind undiscoverable '?' key). Notification system hidden behind undiscoverable 'n' key. No visible bell icon for notifications despite a well-built notification infrastructure.

### [P1] Information Hierarchy (5/8 personas)
No executive summary or global health indicator. Diana: 'I open this dashboard expecting a quick answer — is everything fine? Instead I see a grid of numbers.' No trend data or deltas to contextualize numbers.

### [P1] Onboarding (6/8 personas)
Empty state is a dead-end showing a config file path. No explanation of what the product does. Alex spent 2-5 minutes reading source code before understanding. No demo data to explore.

### [P1] Connection Reliability (7/8 personas)
SSE connection indicator is a barely-visible 2px dot. No 'last updated' timestamp. No disconnection banner. Diana: 'If I cannot trust the data is current, I cannot trust the dashboard.'

---

## Strengths

- **Visual Design System** — Praised by 6/8 personas. The neon cyberpunk aesthetic with professional restraint is distinctive and memorable
- **Keyboard Shortcuts in Run Detail** — Marcus rated the j/k navigation + tab switching as excellent for power users
- **SSE Real-time Updates** — Technically reliable, instant updates when journal files change
- **Pipeline Visualization** — Parallel group rendering, live elapsed timers, cascading timeline bar
- **Error Boundaries** — Section-level error isolation prevents full-page crashes
- **Breakpoint Approval UX** — Two-click confirmation pattern prevents accidental approvals
- **Copy-to-Clipboard Pattern** — Consistent across all ID displays with visual feedback
- **Skeleton Loading States** — Dashboard uses faithful skeleton representations

---

## Critical Changes (Must-Do) — 9 Items

| # | Change | Effort | Personas | Category | Status | Version |
|---|--------|--------|----------|----------|--------|---------|
| 1 | Add notification bell icon with unread badge in header | S | 7/8 | Discoverability | DONE | v0.6.0+cherry-pick |
| 2 | Typography: 12px minimum, remove opacity-based hierarchy | M | 7/8 | Accessibility | DONE | v0.6.0 |
| 3 | Modal focus trapping (Radix Dialog migration) | M | 8/8 | Accessibility | TODO | — |
| 4 | aria-live regions for toasts, breakpoint banner, KPIs | S | 8/8 | Accessibility | PARTIAL | v0.6.0+cherry-pick |
| 5 | aria-pressed on filter pills, landmark roles, skip-nav | M | 8/8 | Accessibility | TODO | — |
| 6 | Rename 'Breakpoint' to 'Approval Required', standardize jargon | M | 7/8 | Comprehension | TODO | — |
| 7 | Mobile panel switcher for run detail page | M | 6/8 | Responsiveness | TODO | — |
| 8 | Touch targets minimum 44x44px across all interactive elements | M | 6/8 | Accessibility | TODO | — |
| 9 | Global health indicator / executive summary banner | M | 5/8 | Information Hierarchy | TODO | — |

> **#4 detail:** aria-live added to toast notifications (role="log", aria-live="assertive"). Still needed: breakpoint banner aria-live, KPI aria-live regions.

---

## Important Changes — 10 Items

| # | Change | Effort | Personas | Category | Status | Version |
|---|--------|--------|----------|----------|--------|---------|
| 1 | Visible '?' button + arrow key alternatives for shortcuts | S | 7/8 | Discoverability | DONE | v0.6.0+cherry-pick |
| 2 | Enlarge SSE connection indicator + disconnection banner | S | 7/8 | Reliability | PARTIAL | v0.6.0+cherry-pick |
| 3 | Add icons to color-only status badges | S | 5/8 | Accessibility | TODO | — |
| 4 | prefers-reduced-motion CSS support | S | 6/8 | Accessibility | DONE | v0.6.0+cherry-pick |
| 5 | Onboarding card with product description + demo data | L | 6/8 | Onboarding | TODO | — |
| 6 | Dashboard keyboard navigation + Ctrl+K command palette | L | 4/8 | Navigation | PARTIAL | v0.6.0 |
| 7 | Notification redesign: persistent breakpoints, batching, audio | M | 4/8 | Notifications | TODO | — |
| 8 | i18n foundation: locale-aware timestamps, idiom removal | M | 4/8 | Internationalization | TODO | — |
| 9 | MetricsRow responsive 2x2 grid on mobile | S | 4/8 | Responsiveness | TODO | — |
| 10 | KPI trend data with delta indicators | XL | 3/8 | Info Hierarchy | TODO | — |

> **#2 detail:** SSE connection chip enlarged with Wifi/WifiOff icons, "Live"/"Offline" text, colored border. Still needed: disconnection banner overlay, "last updated" timestamp.
> **#6 detail:** Global search with `/` shortcut implemented in v0.6.0. Still needed: j/k dashboard navigation, Ctrl+K command palette.

---

## Nice-to-Have Enhancements — 6 Items

| # | Enhancement | Effort | Status |
|---|-------------|--------|--------|
| 1 | Run detail panel drag-to-resize and visible toggle buttons | L | TODO |
| 2 | Visual design consistency: unified loading states, tooltip upgrades | M | TODO |
| 3 | Power user workflows: bulk select, run comparison, skip-confirmation | XL | TODO |
| 4 | Advanced mobile: swipe gestures, bottom sheets, pull-to-refresh | L | TODO |
| 5 | Full i18n framework with string extraction and translation | XL | TODO |
| 6 | Advanced theming: text size slider, high contrast toggle in Settings | L | TODO |

---

## Quick Wins (High Impact, Low Effort)

Start here — these 7 items are all **Small effort** and together transform the experience:

1. **Notification bell icon** — DONE (v0.6.0+cherry-pick). AppHeader includes bell with unread count badge.
2. **aria-live regions** — PARTIAL (v0.6.0+cherry-pick). Toast stack has `role="log"` + `aria-live="assertive"`. Still needed: breakpoint banner, KPI regions.
3. **Visible '?' shortcut button** — DONE (v0.6.0+cherry-pick). HelpCircle button in AppHeader dispatches custom event to open shortcuts panel.
4. **SSE connection status chip** — PARTIAL (v0.6.0+cherry-pick). Enlarged chip with Wifi icon + "Live"/"Offline" text. Still needed: 'last updated' timestamp, disconnection banner.
5. **Icons on color-only badges** — TODO. Need to add icons alongside color in status badges.
6. **prefers-reduced-motion CSS** — DONE (v0.6.0+cherry-pick). `@media (prefers-reduced-motion: reduce)` block disables all animations.
7. **MetricsRow responsive grid** — TODO. CSS-only change, 2x2 on mobile.

---

## Debate Highlights

**Key Conflict: Neon Aesthetic vs. Readability**
Robert and James argued against the opacity-based visual hierarchy. Marcus and Zara defended the visual identity. **Resolution:** Preserve the neon cyberpunk aesthetic but achieve visual hierarchy through font-weight and color rather than size reduction and opacity. 12px minimum floor. Both sides satisfied.

**Key Conflict: Developer Tool vs. Broad Audience**
Resolved via the principle 'Add layers, do not flatten.' Keep all developer features. Add comprehension layers (tooltips, renames, executive banner) on top. Marcus's power features preserved; Sarah's comprehension needs met.

**Key Conflict: Mobile Priority**
Marcus and James argued desktop-first. Zara, Sarah, and Diana argued mobile is critical. **Resolution:** Critical tier covers mobile blockers (panel switcher, touch targets). Nice-to-have tier covers mobile polish (swipe gestures, bottom sheets).

**Pivotal Moment: Sarah's 'Breakpoint Fear'**
Sarah said: 'I am afraid to click Respond because I do not know what I am approving.' This reframed jargon from a cosmetic issue to a safety-critical UX failure — if the human in the loop won't engage, the safety mechanism fails.

---

## Accessibility Audit Summary (James's Review — Score: 38/100)

**WCAG Violations Found:**
- No focus trapping in modals (2.4.3 Focus Order) — TODO
- No aria-live regions for dynamic content (4.1.3 Status Messages) — PARTIAL (toasts done, breakpoint/KPIs remaining)
- Filter pills missing aria-pressed (4.1.2 Name, Role, Value) — TODO
- No skip-to-content link (2.4.1 Bypass Blocks) — TODO
- No main landmark (1.3.1 Info and Relationships) — TODO
- Color-only status indicators (1.4.1 Use of Color) — TODO
- Sub-4.5:1 contrast on muted+opacity text (1.4.3 Contrast Minimum) — DONE (v0.6.0)
- No prefers-reduced-motion support (2.3.3 Animation from Interactions) — DONE (v0.6.0+cherry-pick)
- Touch targets below 44x44px (2.5.5 Target Size) — TODO

**Positive:** Keyboard shortcuts exist and work well in run detail. Radix UI primitives provide proper ARIA for Tabs and Accordion. JsonNode has keyboard support.

---

## Roadmap Timeline

**Phase 1 — Quick Wins** — 5/7 DONE, 2 remaining
~~Notification bell~~, aria-live regions (PARTIAL), ~~'?' button~~, ~~SSE chip~~ (PARTIAL), badge icons (TODO), ~~reduced motion CSS~~, MetricsRow grid (TODO)

**Phase 2 — Accessibility Foundation** — 1/4 DONE, 3 remaining
Modal focus trapping (TODO), aria-pressed/landmarks/skip-nav (TODO), ~~12px minimum typography~~, touch target sizing (TODO)

**Phase 3 — Comprehension & Mobile** — not started
Jargon overhaul, mobile panel switcher, executive health banner, SSE disconnection banner

**Phase 4 — Enhanced Experience** — 1/4 PARTIAL
Onboarding + demo data (TODO), dashboard keyboard nav + command palette (PARTIAL — search done), notification redesign (TODO), i18n foundation (TODO)

**Phase 5 — Polish & Power Features (ongoing)**
Nice-to-have items based on user feedback and adoption metrics — all TODO

---

## Appendix: Per-Persona Summaries

### Marcus (82/100) — Senior Developer
Loves the visual design and run detail keyboard shortcuts. Frustrated by dashboard being mouse-only and invisible notification system. Top ask: j/k navigation on dashboard + command palette.

### Sarah (52/100) — Project Manager
Intimidated by jargon. Cannot extract a status update without developer help. Afraid to interact with breakpoints. Top ask: rename jargon, add executive summary.

### Robert (52/100) — Elderly Ethics Consultant
Cannot physically read 10px text on his monitor. Fatigued by constant animation. Top ask: 12px minimum, reduced motion.

### Zara (72/100) — Gen-Z Intern
Loves the aesthetic, impressed by the design system. Completely blocked on mobile. Top ask: mobile panel switcher.

### Diana (72/100) — CTO
Needs 30-second status comprehension. Current dashboard requires mental computation. Top ask: global health banner.

### James (38/100) — Blind Developer
Dashboard is functionally unusable with NVDA. No focus trapping, no live regions, no landmarks. Top ask: complete ARIA implementation.

### Yuki (58/100) — Japanese Developer
Struggles with English idioms, abbreviations, and inconsistent terminology. Timestamps not locale-aware. Top ask: i18n hygiene.

### Alex (52/100) — First-time Visitor
Spent 5 minutes confused about what the app does. Empty state is a dead end. Top ask: onboarding with demo data.
