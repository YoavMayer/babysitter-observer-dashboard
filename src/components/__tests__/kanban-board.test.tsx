/**
 * Unit tests — KanbanBoard (SPEC-vibekanban §4 data flow, §3.2 auto-hide,
 * §7 loading/error/empty states; Wave 2).
 *
 * The polling hook is mocked (as in run-list.test.tsx) so the component is
 * driven with static data; partition behavior itself is covered by
 * kanban-column-model.test.ts.
 */

import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@/test/test-utils";
import { createMockRun, resetIdCounter } from "@/test/fixtures";
import { KanbanBoard } from "@/components/kanban/kanban-board";
import type { LightRun, RunsListResponse } from "@/lib/services/run-query-service";

// Mock the polling hook so we can drive the component with static data.
const mockUseSmartPolling = vi.fn();
vi.mock("@/hooks/use-smart-polling", () => ({
  useSmartPolling: (...args: unknown[]) => mockUseSmartPolling(...args),
}));

// Mock next/link
vi.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

beforeEach(() => {
  resetIdCounter();
  vi.clearAllMocks();
});

/** Build a LightRun from the shared Run fixture (events stripped);
 *  overrides apply on top so LightRun-only fields (pendingBreakpoints) work. */
function lightRun(overrides: Partial<LightRun> = {}): LightRun {
  const run = createMockRun();
  return { ...run, events: [], totalEvents: 5, ...overrides } as LightRun;
}

function setupPolling(
  data: RunsListResponse | null,
  { loading = false, error = null }: { loading?: boolean; error?: string | null } = {}
) {
  mockUseSmartPolling.mockReturnValue({ data, loading, error, refresh: vi.fn() });
}

describe("KanbanBoard (SPEC-vibekanban Wave 2)", () => {
  it("fetches ONE all-runs query (§4: status='', sort=status, limit=500, offset=0)", () => {
    setupPolling({ runs: [], totalCount: 0 });
    render(<KanbanBoard />);
    expect(mockUseSmartPolling).toHaveBeenCalledTimes(1);
    expect(mockUseSmartPolling.mock.calls[0][0]).toBe(
      "/api/runs?status=&sort=status&limit=500&offset=0&search="
    );
  });

  it("renders per-column loading skeletons with aria-busy, never the board testid (§7)", () => {
    setupPolling(null, { loading: true });
    render(<KanbanBoard />);
    expect(screen.getByTestId("kanban-board-loading")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("Loading runs")).toBeInTheDocument();
    expect(screen.queryByTestId("kanban-board")).not.toBeInTheDocument();
  });

  it("renders the run-list-error treatment full-width on error, board hidden (§7)", () => {
    setupPolling(null, { error: "boom" });
    render(<KanbanBoard />);
    expect(screen.getByTestId("kanban-board-error")).toHaveTextContent("Failed to load runs: boom");
    expect(screen.queryByTestId("kanban-board")).not.toBeInTheDocument();
  });

  it("renders the shared EmptyState full-width for an empty board (§7)", () => {
    setupPolling({ runs: [], totalCount: 0 });
    render(<KanbanBoard />);
    expect(screen.getByTestId("empty-state")).toBeInTheDocument();
    expect(screen.getByText("No runs found")).toBeInTheDocument();
    expect(screen.queryByTestId("kanban-board")).not.toBeInTheDocument();
  });

  it("auto-hides the Orphaned/Stale columns when empty and keeps the four always-visible columns (§3.2)", () => {
    setupPolling({
      runs: [lightRun({ runId: "01KBOARDTESTWORKING00001", status: "waiting", driver: "live" })],
      totalCount: 1,
    });
    render(<KanbanBoard />);

    expect(screen.getByTestId("kanban-board")).toBeInTheDocument();
    expect(screen.getByTestId("kanban-column-needsyou")).toBeInTheDocument();
    expect(screen.getByTestId("kanban-column-waiting")).toBeInTheDocument();
    expect(screen.getByTestId("kanban-column-failed")).toBeInTheDocument();
    expect(screen.getByTestId("kanban-column-completed")).toBeInTheDocument();
    expect(screen.queryByTestId("kanban-column-orphaned")).not.toBeInTheDocument();
    expect(screen.queryByTestId("kanban-column-stale")).not.toBeInTheDocument();
  });

  it("renders all six columns in SPEC §3.2 order when every bucket is populated", () => {
    setupPolling({
      runs: [
        lightRun({ runId: "01KBOARDTESTNEEDSYOU0001", status: "waiting", pendingBreakpoints: 1 }),
        lightRun({ runId: "01KBOARDTESTORPHANED0002", status: "waiting", driver: "none", pendingBreakpoints: 0 }),
        lightRun({ runId: "01KBOARDTESTWORKING00003", status: "waiting", driver: "live", pendingBreakpoints: 0 }),
        lightRun({ runId: "01KBOARDTESTSTALE0000004", status: "waiting", driver: "live", isStale: true, pendingBreakpoints: 0 }),
        lightRun({ runId: "01KBOARDTESTFAILED000005", status: "failed" }),
        lightRun({ runId: "01KBOARDTESTDONE00000006", status: "completed" }),
      ],
      totalCount: 6,
    });
    const { container } = render(<KanbanBoard />);

    const columns = Array.from(
      container.querySelectorAll('[data-testid^="kanban-column-"]')
    )
      .map((el) => el.getAttribute("data-testid"))
      .filter(
        (id) =>
          id !== null &&
          !id.startsWith("kanban-column-count-") &&
          !id.startsWith("kanban-column-cards-")
      );
    expect(columns).toEqual([
      "kanban-column-needsyou",
      "kanban-column-orphaned",
      "kanban-column-waiting",
      "kanban-column-stale",
      "kanban-column-failed",
      "kanban-column-completed",
    ]);
  });

  it("excludes hidden-project runs from grid-parity columns but keeps Needs-you (§6.3)", () => {
    setupPolling({
      runs: [
        lightRun({
          runId: "01KBOARDTESTHIDDENBP0007",
          status: "waiting",
          pendingBreakpoints: 1,
          projectName: "hidden-project",
        }),
        lightRun({
          runId: "01KBOARDTESTHIDDENWK0008",
          status: "waiting",
          driver: "live",
          pendingBreakpoints: 0,
          projectName: "hidden-project",
        }),
      ],
      totalCount: 2,
    });
    render(<KanbanBoard hiddenProjects={new Set(["hidden-project"])} />);

    expect(screen.getByTestId("kanban-column-count-needsyou")).toHaveTextContent("1");
    expect(screen.getByTestId("kanban-column-count-waiting")).toHaveTextContent("0");
  });
});
