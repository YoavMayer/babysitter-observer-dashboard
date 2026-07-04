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
  it("renders the NEEDS YOU label, the FULL question (>120 chars, verbatim) and one chip per option", () => {
    setupTaskDetail(pendingDetail());
    render(<KanbanBreakpointPanel run={makeNeedsYouRun({ driver: "none" })} />);

    expect(QUESTION.length).toBeGreaterThan(120);
    expect(screen.getByText("Needs you")).toBeInTheDocument();
    expect(screen.getByText(QUESTION)).toBeInTheDocument();

    const chips = screen.getAllByTestId("kanban-bp-option-chip");
    expect(chips.map((c) => c.textContent)).toEqual(OPTIONS);
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
