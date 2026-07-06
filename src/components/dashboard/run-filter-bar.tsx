"use client";
import { ArrowUpDown, Clock, EyeOff } from "lucide-react";
import { cn } from "@/lib/cn";
import type { DashboardSortMode, DashboardStatusFilter } from "@/hooks/use-run-dashboard";

const filters: { label: string; value: DashboardStatusFilter }[] = [
  { label: "All", value: "all" },
  { label: "Needs you", value: "needsyou" },
  { label: "Waiting", value: "waiting" },
  { label: "Orphaned", value: "orphaned" },
  { label: "Stale", value: "stale" },
  { label: "Completed", value: "completed" },
  { label: "Failed", value: "failed" },
];

export interface RunFilterBarProps {
  statusFilter: DashboardStatusFilter;
  onStatusFilterChange: (value: DashboardStatusFilter) => void;
  filterCounts: Record<DashboardStatusFilter, number>;
  sortMode: DashboardSortMode;
  onSortModeToggle: () => void;
  filteredProjectCount: number;
  /** Registry-hidden project count — shown as a reveal indicator (QA F4). */
  hiddenProjectCount?: number;
  /** Board/list view toggle slot (SPEC-vibekanban §6.1) — rendered next to the sort toggle. */
  viewToggle?: React.ReactNode;
  /**
   * SPEC-vibekanban §6.2: in board view the sort toggle only affects
   * within-column ordering (status/activity order cards identically there) —
   * the tooltip says so instead of promising a list re-sort.
   */
  boardView?: boolean;
}

export function RunFilterBar({
  statusFilter,
  onStatusFilterChange,
  filterCounts,
  sortMode,
  onSortModeToggle,
  filteredProjectCount,
  hiddenProjectCount = 0,
  viewToggle,
  boardView = false,
}: RunFilterBarProps) {
  return (
    <div className="mb-5">
      <div data-testid="filter-bar" className="flex items-center gap-1">
        {filters.map((f) => {
          const count = filterCounts[f.value] ?? 0;
          // Hide Stale / Orphaned filter pills when there are no matching runs
          if ((f.value === "stale" || f.value === "orphaned") && count === 0) return null;
          return (
            <button
              key={f.value}
              data-testid={`filter-pill-${f.value}`}
              aria-pressed={statusFilter === f.value}
              onClick={() => onStatusFilterChange(f.value)}
              className={cn(
                "rounded-md px-3 py-1.5 min-h-[44px] text-xs transition-all inline-flex items-center gap-1.5",
                // UX-R3 §14.2 (owner gate 2026-07-06, option a): active-nav is
                // NEUTRAL, not magenta — foreground ink + a subtle foreground/7%
                // fill + a 2px foreground underline + weight 600. Unmistakably
                // "current" in both themes without borrowing the brand hue.
                statusFilter === f.value
                  ? "bg-foreground/[0.07] text-foreground font-semibold border-b-2 border-foreground"
                  : "font-medium text-foreground-muted hover:text-foreground-secondary hover:bg-background-secondary"
              )}
            >
              {f.label}
              {count > 0 && (
                <span className={cn(
                  "rounded-full px-1.5 py-px text-xs leading-tight font-semibold tabular-nums",
                  statusFilter === f.value
                    ? "bg-foreground/10 text-foreground"
                    : "bg-background-secondary text-foreground-muted"
                )}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
        {/* QA F4: hidden projects are dropped from the grid but NOT from the
            needs-you alarm surface — make the hiding visible and reversible.
            Opens Settings (manage hidden projects) via the open-settings event. */}
        {hiddenProjectCount > 0 && (
          <button
            data-testid="hidden-projects-indicator"
            onClick={() => window.dispatchEvent(new CustomEvent("open-settings"))}
            title={`${hiddenProjectCount} project${hiddenProjectCount !== 1 ? "s" : ""} hidden from the grid (needs-you alerts still shown). Click to manage in Settings.`}
            className="ml-1 rounded-md px-2.5 py-1.5 min-h-[44px] text-xs font-medium inline-flex items-center gap-1.5 text-foreground-muted hover:text-foreground-secondary hover:bg-background-secondary transition-all"
          >
            <EyeOff className="h-3 w-3" aria-hidden="true" focusable="false" />
            {hiddenProjectCount} hidden
          </button>
        )}
        {/* View toggle + Sort toggle + Project count */}
        <div className="ml-auto flex items-center gap-2">
          {viewToggle}
          <button
            data-testid="sort-toggle"
            onClick={onSortModeToggle}
            className={cn(
              "rounded-md px-2.5 py-1.5 min-h-[44px] text-xs font-medium inline-flex items-center gap-1.5",
              "transition-all duration-200 ease-in-out",
              // UX-R3 §14.7 (owner gate 2026-07-06, option a): the "By Status"
              // group toggle read gold (--status-attention, a STATUS hue on
              // chrome) and "By Activity" read magenta — both fold into one
              // NEUTRAL chrome treatment. The icon + label carry the mode; hue
              // no longer does.
              "bg-background-secondary border border-border text-foreground-secondary hover:bg-background-tertiary hover:text-foreground shadow-sm"
            )}
            title={boardView
              // §6.2: board columns always order by latest update; the control
              // stays for list-mode continuity. Wording deliberately avoids
              // "Switch to": the theme-toggle e2e locates by title*="Switch to"
              // and a second match would be a strict-mode violation.
              ? "In board view, sorting applies within columns (cards order by latest update). Use List view for status/activity re-sorting."
              : sortMode === "status"
                ? "Currently sorting by status priority (active first, then failed, then completed). Click to switch to chronological activity view."
                : "Currently sorting by most recent activity (newest updates first). Click to switch to status-grouped view."
            }
          >
            {/* a11y-icons-not-hidden: decorative sort icons hidden from AT. */}
            {sortMode === "status" ? (
              <ArrowUpDown className="h-3 w-3 transition-transform duration-200" aria-hidden="true" focusable="false" />
            ) : (
              <Clock className="h-3 w-3 transition-transform duration-200" aria-hidden="true" focusable="false" />
            )}
            {sortMode === "status" ? "By Status" : "By Activity"}
          </button>
          <span data-testid="project-count" className="text-xs text-foreground-muted tabular-nums">
            {filteredProjectCount} project{filteredProjectCount !== 1 ? "s" : ""}
          </span>
        </div>
      </div>
    </div>
  );
}
