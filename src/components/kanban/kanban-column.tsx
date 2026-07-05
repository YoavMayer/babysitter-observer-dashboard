"use client";
import { useEffect, useRef } from "react";
import { ArrowRight } from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { cn } from "@/lib/cn";
import { KanbanCard } from "@/components/kanban/kanban-card";
import { VIRTUALIZATION_THRESHOLD } from "@/components/dashboard/virtualized-run-list";
import type { UseBoardKeyboardResult } from "@/components/kanban/use-board-keyboard";
import type { BoardColumnKey, BoardRun } from "@/components/kanban/column-model";

/**
 * A single board column — SPEC-vibekanban §3.2 (labels/tones), §6.2 (pill →
 * column focus), §7 (empty placeholders, virtualization), §8 (list semantics).
 *
 * Header shows the column label and an HONEST count (§3.4): the number of
 * cards actually in this column post-partition. The Orphaned column may carry
 * a tooltip explaining runs captured by Needs-you precedence — no silent
 * mismatch between pill counts (overlapping buckets) and column counts
 * (disjoint partition).
 *
 * Columns above VIRTUALIZATION_THRESHOLD items virtualize their card list with
 * the existing @tanstack/react-virtual dependency (same cutoff/pattern as
 * virtualized-run-list.tsx; stable runId item keys), scrolling independently
 * inside the column — never delegating to the page body.
 *
 * Frozen DOM contract (kanban-board.spec.ts): exactly three testid families —
 * kanban-column-<key>, kanban-column-count-<key>, kanban-column-cards-<key> —
 * plus data-focused/data-dimmed for the pill-focus treatment (AC-23).
 */

/** Estimated compact-card height (px) for initial virtual measurement (§5). */
const ESTIMATED_CARD_HEIGHT = 110;

/** Overscan matching the flat-list virtualization pattern. */
const OVERSCAN_COUNT = 3;

interface ColumnSpec {
  label: string;
  /** Optional sub-label under the header label (Working: "waiting / running"). */
  subLabel?: string;
  /** §7 quiet placeholder for always-visible columns (auto-hide columns omit it). */
  emptyText?: string;
  /** Column tone (§3.2): header accent classes. */
  headerClass: string;
  /** Success-tinted empty placeholder for the alarm column ("all clear"). */
  emptyClass?: string;
}

/** Column labels/tones per SPEC §3.2 and empty placeholders per §7. */
export const COLUMN_SPECS: Record<BoardColumnKey, ColumnSpec> = {
  needsyou: {
    label: "Needs you",
    emptyText: "Nothing needs you — all clear.",
    headerClass: "text-warning",
    emptyClass: "text-success",
  },
  orphaned: {
    label: "Orphaned",
    headerClass: "text-error",
  },
  waiting: {
    label: "Working",
    subLabel: "waiting / running",
    emptyText: "No runs in progress.",
    headerClass: "text-primary",
  },
  stale: {
    label: "Stale",
    headerClass: "text-zinc-500",
  },
  failed: {
    label: "Failed",
    emptyText: "No failed runs.",
    headerClass: "text-error/70",
  },
  completed: {
    label: "Completed",
    emptyText: "No completed runs in the retention window.",
    headerClass: "text-foreground-muted",
  },
};

export interface KanbanColumnProps {
  columnKey: BoardColumnKey;
  runs: BoardRun[];
  /** Count-honesty tooltip (§3.4) — e.g. orphaned runs captured by Needs-you. */
  countTooltip?: string | null;
  /** §6.2 pill focus: this column is highlighted and scrolled into view. */
  focused?: boolean;
  /** §6.2 pill focus: another column is focused — dim this one. */
  dimmed?: boolean;
  /** §8 roving tabindex wiring (from useBoardKeyboard), passed to every card. */
  keyboard?: UseBoardKeyboardResult;
  /**
   * §7 fetch-window tail: when set, render a "View all in list →" row that
   * switches to list view with this column's status filter pre-applied.
   */
  onViewAllInList?: () => void;
}

export function KanbanColumn({
  columnKey,
  runs,
  countTooltip,
  focused = false,
  dimmed = false,
  keyboard,
  onViewAllInList,
}: KanbanColumnProps) {
  const spec = COLUMN_SPECS[columnKey];
  const sectionRef = useRef<HTMLElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);

  // §6.2: clicking a status pill focuses the corresponding column — scroll it
  // into view (the highlight ring is applied via data-focused styling below).
  useEffect(() => {
    if (focused) {
      sectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "nearest",
      });
    }
  }, [focused]);

  // §7: virtualize above the shared threshold with stable runId item keys.
  const virtualize = runs.length >= VIRTUALIZATION_THRESHOLD;
  const virtualizer = useVirtualizer({
    count: runs.length,
    getScrollElement: () => cardsRef.current,
    estimateSize: () => ESTIMATED_CARD_HEIGHT,
    overscan: OVERSCAN_COUNT,
    getItemKey: (index) => runs[index]?.runId ?? index,
    enabled: virtualize,
  });

  return (
    <section
      ref={sectionRef}
      data-testid={`kanban-column-${columnKey}`}
      data-focused={focused ? "true" : undefined}
      data-dimmed={dimmed ? "true" : undefined}
      className={cn(
        "flex flex-col min-w-[280px] w-[280px] shrink-0 rounded-lg border border-border bg-background-secondary/40",
        // Alarm surface tone (§3.2): the Needs-you column glows.
        columnKey === "needsyou" && "border-warning/30",
        // Terminal columns are visually de-emphasized.
        columnKey === "completed" && "opacity-80",
        // §6.2 focus/dim treatment: highlight ring vs opacity dim.
        focused && "ring-2 ring-primary/60",
        dimmed && "opacity-40"
      )}
    >
      {/* Header: label + honest count (§3.4). */}
      <div
        className="flex items-baseline gap-2 px-3 py-2 border-b border-border"
        title={countTooltip ?? undefined}
      >
        <span className={cn("text-xs font-semibold uppercase tracking-wide", spec.headerClass)}>
          {spec.label}
        </span>
        {spec.subLabel && (
          <span className="text-[10px] text-foreground-muted">{spec.subLabel}</span>
        )}
        <span
          data-testid={`kanban-column-count-${columnKey}`}
          className="ml-auto rounded-full bg-background-secondary px-1.5 py-px text-xs leading-tight font-semibold tabular-nums text-foreground-muted"
        >
          {runs.length}
        </span>
      </div>

      {/* Independently scrolling card area (§7: viewport-bound, never the page body). */}
      <div
        ref={cardsRef}
        data-testid={`kanban-column-cards-${columnKey}`}
        role="list"
        aria-label={`${spec.label}, ${runs.length} runs`}
        className={cn(
          "p-2 overflow-y-auto max-h-[calc(100vh-260px)]",
          !virtualize && "flex flex-col gap-2"
        )}
      >
        {runs.length === 0 && spec.emptyText ? (
          // §7 quiet per-column placeholder — never a blank void.
          <p className={cn("px-2 py-6 text-center text-xs text-foreground-muted", spec.emptyClass)}>
            {spec.emptyText}
          </p>
        ) : !virtualize ? (
          runs.map((run) => (
            <KanbanCard key={run.runId} run={run} keyboard={keyboard} />
          ))
        ) : (
          // Virtualized card list (pattern from virtualized-run-list.tsx):
          // only visible cards + overscan render; header count stays honest.
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: "100%",
              position: "relative",
            }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const run = runs[virtualRow.index];
              if (!run) return null;
              return (
                <div
                  key={virtualRow.key}
                  data-index={virtualRow.index}
                  ref={virtualizer.measureElement}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <div style={{ paddingBottom: 8 }}>
                    <KanbanCard run={run} keyboard={keyboard} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* §7 fetch-window tail: the 500-run window may be hiding runs from any
          column — offer the complete flat list with this filter pre-applied. */}
      {onViewAllInList && (
        <button
          type="button"
          data-testid={`kanban-column-tail-${columnKey}`}
          onClick={onViewAllInList}
          className="flex items-center justify-center gap-1 border-t border-border px-3 py-1.5 text-xs font-medium text-foreground-muted hover:text-foreground-secondary hover:bg-background-secondary transition-colors rounded-b-lg"
        >
          View all in list
          <ArrowRight className="h-3 w-3" aria-hidden="true" focusable="false" />
        </button>
      )}
    </section>
  );
}
