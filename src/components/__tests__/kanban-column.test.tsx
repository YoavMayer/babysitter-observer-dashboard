/**
 * Unit tests — KanbanColumn (SPEC-vibekanban §3.4 count honesty, §7 empty
 * placeholders, §8 list semantics; Wave 2).
 */

import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@/test/test-utils";
import { createMockRun, resetIdCounter } from "@/test/fixtures";
import { KanbanColumn } from "@/components/kanban/kanban-column";
import type { BoardRun } from "@/components/kanban/column-model";

// Mock next/link (the card renders a stretched overlay Link).
vi.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

beforeEach(() => {
  resetIdCounter();
});

/** Build a BoardRun from the shared Run fixture (events stripped);
 *  overrides apply on top so BoardRun-only fields work. */
function boardRun(overrides: Partial<BoardRun> = {}): BoardRun {
  const run = createMockRun();
  return { ...run, events: [], totalEvents: 5, ...overrides } as BoardRun;
}

describe("KanbanColumn (SPEC-vibekanban Wave 2)", () => {
  it("renders the header count equal to the number of rendered cards (§3.4 count honesty)", () => {
    const runs = [
      boardRun({ runId: "01KCOLTESTRUNAAAAAAAAAA1", status: "waiting" }),
      boardRun({ runId: "01KCOLTESTRUNAAAAAAAAAA2", status: "waiting" }),
    ];
    render(<KanbanColumn columnKey="waiting" runs={runs} />);

    expect(screen.getByTestId("kanban-column-count-waiting")).toHaveTextContent("2");
    expect(screen.getAllByTestId("kanban-card")).toHaveLength(2);
  });

  it("exposes list semantics with an accessible column name (§8)", () => {
    render(
      <KanbanColumn
        columnKey="waiting"
        runs={[boardRun({ runId: "01KCOLTESTRUNAAAAAAAAAA3", status: "waiting" })]}
      />
    );
    expect(screen.getByRole("list", { name: "Working, 1 runs" })).toBeInTheDocument();
  });

  it("shows the quiet §7 placeholder for an empty always-visible column", () => {
    render(<KanbanColumn columnKey="needsyou" runs={[]} />);
    expect(screen.getByText("Nothing needs you — all clear.")).toBeInTheDocument();
    expect(screen.getByTestId("kanban-column-count-needsyou")).toHaveTextContent("0");
    expect(screen.queryAllByTestId("kanban-card")).toHaveLength(0);
  });

  it("surfaces the count-honesty tooltip on the header (§3.4 — no silent mismatch)", () => {
    render(
      <KanbanColumn
        columnKey="orphaned"
        runs={[boardRun({ runId: "01KCOLTESTRUNAAAAAAAAAA4", status: "waiting", driver: "none" })]}
        countTooltip="+2 more orphaned runs are shown under Needs you"
      />
    );
    const header = screen.getByTitle("+2 more orphaned runs are shown under Needs you");
    expect(header).toBeInTheDocument();
  });
});
