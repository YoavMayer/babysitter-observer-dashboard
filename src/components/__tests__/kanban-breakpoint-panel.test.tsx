/**
 * Unit tests — KanbanBreakpointPanel (SPEC-vibekanban §5 Needs-you card
 * additions; Wave 3).
 *
 * The task-detail hook is mocked so the panel is driven with a static
 * BreakpointPayload; the approve server action is mocked out (jsdom cannot
 * invoke server actions). The write path itself is covered by the existing
 * breakpoint-approval tests + the approve e2e.
 */

import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@/test/test-utils";
import { createMockRun, createMockTaskEffect, createMockTaskDetail, resetIdCounter } from "@/test/fixtures";
import { KanbanBreakpointPanel } from "@/components/kanban/kanban-breakpoint-panel";
import type { BoardRun } from "@/components/kanban/column-model";
import type { TaskDetail } from "@/types";

// Mock the task-detail hook (GET polling) — the panel's only data source.
const mockUseTaskDetail = vi.fn();
vi.mock("@/hooks/use-run-detail", () => ({
  useTaskDetail: (...args: unknown[]) => mockUseTaskDetail(...args),
}));

// The approve server action is unreachable from jsdom — mock the module so
// importing BreakpointApproval doesn't pull the "use server" runtime in.
vi.mock("@/app/actions/approve-breakpoint", () => ({
  approveBreakpoint: vi.fn(async () => ({ success: true })),
}));

const QUESTION =
  "The staging deploy changes the database schema, rotates two service credentials, and restarts the ingest workers — do you approve rolling this out to the shared staging environment now?";
const OPTIONS = ["approve", "reject", "defer to tomorrow"];

function makeNeedsYouRun(overrides: Partial<BoardRun> = {}): BoardRun {
  const bpTask = createMockTaskEffect({
    effectId: "eff-bp-1",
    kind: "breakpoint",
    status: "requested",
    breakpointQuestion: QUESTION,
  });
  const run = createMockRun({
    runId: "01KTESTPANELRUN000000001",
    status: "waiting",
    tasks: [bpTask],
    breakpointQuestion: QUESTION,
  });
  return { ...run, events: [], totalEvents: 5, pendingBreakpoints: 1, ...overrides } as BoardRun;
}

function setupTaskDetail(task: TaskDetail | null) {
  mockUseTaskDetail.mockReturnValue({ task, loading: false, error: null });
}

function pendingDetail(): TaskDetail {
  return createMockTaskDetail({
    effectId: "eff-bp-1",
    kind: "breakpoint",
    status: "requested",
    breakpoint: { question: QUESTION, title: "Approval", options: OPTIONS },
  });
}

beforeEach(() => {
  resetIdCounter();
  vi.clearAllMocks();
});

describe("KanbanBreakpointPanel (SPEC-vibekanban §5, Wave 3)", () => {
  // UX-R3 §14.3 / AC-55 (owner gate 2026-07-06 ruling, option a): the gold
  // informative option chips are REMOVED (de-dup). Options render exactly once
  // as the neutral buttons inside the expandable answer panel — the collapsed
  // card shows the NEEDS YOU label + full question only.
  it("renders the NEEDS YOU label + FULL question (>120 chars, verbatim); options are NOT chips and appear once as buttons on expand", () => {
    setupTaskDetail(pendingDetail());
    render(<KanbanBreakpointPanel run={makeNeedsYouRun({ driver: "none" })} />);

    expect(QUESTION.length).toBeGreaterThan(120);
    expect(screen.getByText("Needs you")).toBeInTheDocument();
    expect(screen.getByText(QUESTION)).toBeInTheDocument();

    // No gold chips anywhere (superseded §13.3 chip rule).
    expect(screen.queryAllByTestId("kanban-bp-option-chip")).toHaveLength(0);
    // Options are not on the collapsed card at all.
    for (const option of OPTIONS) {
      expect(screen.queryByTestId(`option-btn-${option}`)).not.toBeInTheDocument();
    }

    // Expand the answer panel — each option now appears exactly once, as a button.
    fireEvent.click(screen.getByTestId("kanban-bp-answer-toggle"));
    for (const option of OPTIONS) {
      expect(screen.getAllByTestId(`option-btn-${option}`)).toHaveLength(1);
    }
  });

  it("asks the task-detail endpoint for the pending breakpoint effect (GET-only data source)", () => {
    setupTaskDetail(pendingDetail());
    render(<KanbanBreakpointPanel run={makeNeedsYouRun()} />);
    expect(mockUseTaskDetail).toHaveBeenCalledWith("01KTESTPANELRUN000000001", "eff-bp-1");
  });

  it("shows the orphaned informing hint (no live driver) for driver 'none' — never 'Answer in terminal'", () => {
    setupTaskDetail(pendingDetail());
    render(<KanbanBreakpointPanel run={makeNeedsYouRun({ driver: "none" })} />);

    expect(screen.getByText(/No live driver — resume to answer/)).toBeInTheDocument();
    expect(screen.queryByText(/Answer in terminal/)).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /copy run id/i })
    ).toBeInTheDocument();
  });

  it("shows the 'Answer in terminal' hint for a live driver", () => {
    setupTaskDetail(pendingDetail());
    render(<KanbanBreakpointPanel run={makeNeedsYouRun({ driver: "live" })} />);

    expect(screen.getByText(/Answer in terminal/)).toBeInTheDocument();
    expect(screen.queryByText(/No live driver — resume to answer/)).not.toBeInTheDocument();
  });

  it("mounts the existing BreakpointApproval (the only write path) when the Answer section expands", () => {
    setupTaskDetail(pendingDetail());
    render(<KanbanBreakpointPanel run={makeNeedsYouRun()} />);

    // Collapsed by default — no approval form mounted.
    expect(screen.queryByTestId("breakpoint-approval")).not.toBeInTheDocument();

    const toggle = screen.getByTestId("kanban-bp-answer-toggle");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId("breakpoint-approval")).toBeInTheDocument();
    // The existing option buttons come along unchanged.
    expect(screen.getByTestId("option-btn-approve")).toBeInTheDocument();
  });

  it("renders nothing when the run has no pending breakpoint task (legacy shapes)", () => {
    setupTaskDetail(null);
    const run = makeNeedsYouRun({
      tasks: [createMockTaskEffect({ kind: "agent", status: "requested" })],
    });
    const { container } = render(<KanbanBreakpointPanel run={run} />);
    expect(container).toBeEmptyDOMElement();
    // The hook is still called (hooks-before-early-return) but disabled.
    expect(mockUseTaskDetail).toHaveBeenCalledWith("01KTESTPANELRUN000000001", null);
  });
});

// ---------------------------------------------------------------------------
// UX-R2 §13.4 — read-only clarity (AC-43..AC-45 component-level coverage).
// ---------------------------------------------------------------------------

describe("KanbanBreakpointPanel — UX-R2 §13.4 read-only clarity", () => {
  const CONTRACT_LINE =
    "The observer is read-only — except this single action: recording your breakpoint answer.";
  const ORPHANED_SEMANTICS =
    "Recorded now → applied when the run is resumed (babysitter run:iterate).";
  const ORPHANED_CONFIRMATION =
    "Answer recorded. It will be applied when the run is resumed.";

  it("AC-43: renders the contract line VERBATIM, always visible while the answer input stays collapsed", () => {
    setupTaskDetail(pendingDetail());
    render(<KanbanBreakpointPanel run={makeNeedsYouRun({ driver: "live" })} />);

    const contract = screen.getByTestId("bp-readonly-contract");
    expect(contract).toHaveTextContent(CONTRACT_LINE);
    // ...above any input: the input is not even mounted yet.
    expect(screen.queryByTestId("custom-answer-input")).not.toBeInTheDocument();
  });

  it("AC-44: an orphaned (driver 'none') run shows the orphaned-semantics line VERBATIM before any interaction", () => {
    setupTaskDetail(pendingDetail());
    render(<KanbanBreakpointPanel run={makeNeedsYouRun({ driver: "none" })} />);

    expect(screen.getByTestId("bp-orphaned-semantics")).toHaveTextContent(
      ORPHANED_SEMANTICS
    );
    // The answer input is NOT in the accessible tree until the toggle expands.
    expect(screen.queryByTestId("custom-answer-input")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("kanban-bp-answer-toggle"));
    expect(screen.getByTestId("custom-answer-input")).toBeInTheDocument();
  });

  it("AC-44: a live-driver run gets NO orphaned-semantics line (base-branch behavior)", () => {
    setupTaskDetail(pendingDetail());
    render(<KanbanBreakpointPanel run={makeNeedsYouRun({ driver: "live" })} />);
    expect(screen.queryByTestId("bp-orphaned-semantics")).not.toBeInTheDocument();
  });

  it("AC-45: submitting an answer on an orphaned run shows the post-submit confirmation VERBATIM", async () => {
    setupTaskDetail(pendingDetail());
    render(<KanbanBreakpointPanel run={makeNeedsYouRun({ driver: "orphaned" })} />);

    fireEvent.click(screen.getByTestId("kanban-bp-answer-toggle"));
    fireEvent.click(screen.getByTestId("option-btn-approve"));

    const result = await screen.findByTestId("approval-result");
    expect(result).toHaveTextContent(ORPHANED_CONFIRMATION);
    expect(result).not.toHaveTextContent("approved successfully");
  });
});
