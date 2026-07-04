/**
 * FROZEN acceptance test — SPEC-vibekanban §10, AC-26 (card chip gating).
 *
 * Authored BEFORE any board implementation exists (pending-impl). Imports the
 * SPEC-declared component path `src/components/kanban/kanban-card` (SPEC §9).
 * Until Wave 2 lands that component, this file fails to load with a
 * module-resolution error — the expected frozen state. Do NOT weaken these
 * assertions; implement the component instead.
 *
 * Contract under test (SPEC §5, mirroring run-list.tsx chip gating):
 *   <KanbanCard run={lightRun} />
 *   - non-terminal runs render the LivenessChip (live wifi chip / orphaned
 *     triangle chip) with its sr-only expansions preserved;
 *   - terminal runs render the neutral StatusDot ("Run status: ..." sr-only).
 */

import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@/test/test-utils";
import type { Run } from "@/types";
import type { LightRun } from "@/lib/services/run-query-service";
// pending-impl: SPEC-declared component path — does not exist until Wave 2.
import { KanbanCard } from "@/components/kanban/kanban-card";

const RECENT_DATE = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();

function makeLightRun(overrides: Partial<LightRun> = {}): LightRun {
  const base: Omit<Run, "events"> = {
    runId: "01KTESTKANBANCARD0000001",
    processId: "data-pipeline",
    status: "waiting",
    createdAt: RECENT_DATE,
    updatedAt: RECENT_DATE,
    tasks: [],
    totalTasks: 4,
    completedTasks: 2,
    failedTasks: 0,
    projectName: "my-project",
  };
  return {
    ...base,
    events: [] as never[],
    totalEvents: 5,
    ...overrides,
  } as LightRun;
}

// sr-only strings are the exact LivenessChip/StatusDot expansions from
// src/components/dashboard/run-list.tsx (a11y-status-chip-title-only).
const LIVE_SR_TEXT = /a live orchestrator is attached to this run/i;
const ORPHANED_SR_TEXT = /no live orchestrator is attached/i;
const STATUS_DOT_SR_TEXT = /run status:/i;

describe("KanbanCard chip gating (SPEC-vibekanban AC-26)", () => {
  it("AC-26: renders the LivenessChip (live) for a non-terminal run with a live driver — and no StatusDot", () => {
    render(
      <KanbanCard
        run={makeLightRun({ status: "waiting", driver: "live", isStale: false })}
      />
    );
    expect(screen.getByText(LIVE_SR_TEXT)).toBeInTheDocument();
    expect(screen.queryByText(STATUS_DOT_SR_TEXT)).not.toBeInTheDocument();
  });

  it("AC-26: renders the LivenessChip (orphaned) for a non-terminal run with no live driver — and no StatusDot", () => {
    render(
      <KanbanCard
        run={makeLightRun({ status: "pending", driver: "none", pendingBreakpoints: 0 })}
      />
    );
    expect(screen.getByText(ORPHANED_SR_TEXT)).toBeInTheDocument();
    expect(screen.queryByText(STATUS_DOT_SR_TEXT)).not.toBeInTheDocument();
  });

  it("AC-26: renders the StatusDot for a terminal (completed) run — and no LivenessChip", () => {
    render(
      <KanbanCard
        run={makeLightRun({ status: "completed", completedTasks: 4, driver: "none" })}
      />
    );
    expect(screen.getByText(STATUS_DOT_SR_TEXT)).toBeInTheDocument();
    expect(screen.queryByText(LIVE_SR_TEXT)).not.toBeInTheDocument();
    expect(screen.queryByText(ORPHANED_SR_TEXT)).not.toBeInTheDocument();
  });

  it("AC-26: renders the StatusDot for a terminal (failed) run — and no LivenessChip", () => {
    render(
      <KanbanCard run={makeLightRun({ status: "failed", failedTasks: 1 })} />
    );
    expect(screen.getByText(STATUS_DOT_SR_TEXT)).toBeInTheDocument();
    expect(screen.queryByText(LIVE_SR_TEXT)).not.toBeInTheDocument();
    expect(screen.queryByText(ORPHANED_SR_TEXT)).not.toBeInTheDocument();
  });
});
