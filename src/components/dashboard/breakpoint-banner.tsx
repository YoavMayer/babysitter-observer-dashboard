"use client";
import { useState, useEffect, useLayoutEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { Hand, AlertTriangle, CheckCircle2, X, Terminal, Copy } from "lucide-react";
import type { BreakpointRunInfo } from "@/types";

interface ResolvedEntry {
  bp: BreakpointRunInfo;
  resolvedAt: number;
}

const RESOLVED_DISPLAY_MS = 20000; // 20 seconds
const STALENESS_THRESHOLD_MS = 120000; // 2 minutes — if a breakpoint has been shown
                                        // continuously for this long, show a hint
const DISMISSED_KEY = "observer:dismissed-breakpoints";

/** Inline approve button for a single breakpoint in the dashboard banner. */
function BreakpointBannerItem({ bp, stale, onDismiss }: { bp: BreakpointRunInfo; stale: boolean; onDismiss?: () => void }) {
  // Read-only "inform, don't rule": the observer surfaces that a decision is
  // waiting + how to answer it, but never writes the approval itself (that would
  // sit inert if no orchestrator is attached). The answer happens in the terminal
  // driving the run. `driver` (from run.lock) tells us if that's even possible now.
  const [copied, setCopied] = useState(false);
  const orphaned = bp.driver === "orphaned" || bp.driver === "none";

  const copyRunId = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      navigator.clipboard?.writeText(bp.runId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard may be unavailable (non-secure context) — non-fatal
    }
  };

  return (
    <div className={cn(
      "group relative flex items-center gap-3 px-4 py-3 rounded-lg",
      "bg-warning-muted border border-warning/30",
      "shadow-breakpoint-glow animate-breakpoint-glow",
      stale && "opacity-70"
    )}>
      <Link href={`/runs/${bp.runId}`} className="flex items-center gap-3 flex-1 min-w-0">
        <div className="relative shrink-0">
          <Hand className="h-5 w-5 text-warning animate-pulse-dot" />
          <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-warning animate-ping" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <AlertTriangle className="h-3 w-3 text-warning shrink-0" />
            <span className="text-xs font-bold text-warning uppercase tracking-wider">
              Needs You
            </span>
            {stale && (
              // QA F8: no probe runs from this card, so never imply one
              // ("checking..."). Report the real signal we DO have: run.lock
              // driver liveness (bp.driver), the same primitive behind the
              // "No live driver" pill below.
              <span className="text-xs text-foreground-muted italic" data-testid="staleness-indicator">
                {bp.driver === "live" ? "(still waiting — driver attached)" : "(still waiting)"}
              </span>
            )}
            <span className="text-xs text-foreground-muted font-medium">
              {bp.projectName}
            </span>
            <span className="font-mono text-xs text-info">
              {bp.runId.slice(0, 8)}
            </span>
          </div>
          <p className="text-sm text-foreground truncate">
            {bp.breakpointQuestion}
          </p>
        </div>
      </Link>
      {/* Inform + point to the terminal — never write the approval from here. */}
      <div className="shrink-0 flex flex-col items-end gap-1" data-testid="breakpoint-action-hint">
        {orphaned ? (
          <span
            // §13.3: red = terminal failure ONLY. Orphaned is recoverable
            // (resume applies the answer), so it wears the stalled tokens —
            // same migration as run-list.tsx's ActionHint.
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-status-stalled-muted text-status-stalled border border-status-stalled/30"
            // §13.4: honest orphaned semantics — recorded now, applied on resume.
            title="No live orchestrator is attached. Recorded now → applied when the run is resumed (babysitter run:iterate)."
          >
            <AlertTriangle className="h-3.5 w-3.5" /> No live driver — resume to answer
          </span>
        ) : (
          <span
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-warning/15 text-warning border border-warning/30"
            title="Answer this in the terminal that is driving this run"
          >
            <Terminal className="h-3.5 w-3.5" /> Answer in terminal
          </span>
        )}
        <button
          onClick={copyRunId}
          className="flex items-center gap-1 text-[10px] text-foreground-muted hover:text-foreground transition-colors"
          title="Copy run id (resolve it with: babysitter run:iterate <run>)"
        >
          <Copy className="h-3 w-3" /> {copied ? "copied" : "copy run id"}
        </button>
      </div>
      {stale && onDismiss && (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDismiss();
          }}
          className={cn(
            "shrink-0 p-1 rounded text-foreground-muted/50",
            "hover:text-foreground-muted hover:bg-foreground-muted/10",
            "transition-colors"
          )}
          title="Dismiss this stale breakpoint"
          data-testid="dismiss-breakpoint"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

interface BreakpointBannerProps {
  breakpointRuns: BreakpointRunInfo[];
}

export function BreakpointBanner({ breakpointRuns }: BreakpointBannerProps) {
  const [resolvedEntries, setResolvedEntries] = useState<ResolvedEntry[]>([]);
  const prevRunIdsRef = useRef<Map<string, BreakpointRunInfo>>(new Map());

  // Track when each breakpoint entry was first seen (by runId).
  // Entries are cleaned up when the breakpoint disappears from the list.
  const firstSeenRef = useRef<Map<string, number>>(new Map());

  // Dismissed stale breakpoints (client-side only, persisted in localStorage)
  // Start with empty set to match SSR, then read localStorage before paint.
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  useLayoutEffect(() => {
    try {
      const raw = localStorage.getItem(DISMISSED_KEY);
      if (raw) {
        setDismissedIds(new Set(JSON.parse(raw) as string[]));
      }
    } catch {
      // localStorage unavailable
    }
  }, []);

  const dismissBreakpoint = useCallback((runId: string) => {
    setDismissedIds((prev) => {
      const next = new Set(prev);
      next.add(runId);
      try { localStorage.setItem(DISMISSED_KEY, JSON.stringify([...next])); } catch { /* noop */ }
      return next;
    });
  }, []);

  // Clean up dismissed IDs that are no longer in the breakpointRuns list
  useEffect(() => {
    const currentIds = new Set(breakpointRuns.map((bp) => bp.runId));
    setDismissedIds((prev) => {
      const cleaned = new Set([...prev].filter((id) => currentIds.has(id)));
      if (cleaned.size !== prev.size) {
        try { localStorage.setItem(DISMISSED_KEY, JSON.stringify([...cleaned])); } catch { /* noop */ }
        return cleaned;
      }
      return prev;
    });
  }, [breakpointRuns]);

  // State to trigger re-renders for staleness checks
  const [, setStalenessTick] = useState(0);

  // Detect resolved breakpoints: runs that were previously in the list but are now gone
  useEffect(() => {
    const currentIds = new Set(breakpointRuns.map((bp) => bp.runId));
    const now = Date.now();

    const newlyResolved: ResolvedEntry[] = [];
    for (const [runId, bp] of prevRunIdsRef.current) {
      if (!currentIds.has(runId)) {
        newlyResolved.push({ bp, resolvedAt: now });
        // Clean up first-seen tracking for resolved breakpoints
        firstSeenRef.current.delete(runId);
      }
    }

    if (newlyResolved.length > 0) {
      setResolvedEntries((prev) => [...prev, ...newlyResolved]);
    }

    // Record first-seen time for new breakpoints
    for (const bp of breakpointRuns) {
      if (!firstSeenRef.current.has(bp.runId)) {
        firstSeenRef.current.set(bp.runId, now);
      }
    }

    // Update prev ref
    prevRunIdsRef.current = new Map(breakpointRuns.map((bp) => [bp.runId, bp]));
  }, [breakpointRuns]);

  // Periodic tick to re-evaluate staleness (every 10s while breakpoints are active)
  useEffect(() => {
    if (breakpointRuns.length === 0) return;

    const timer = setInterval(() => {
      setStalenessTick((t) => t + 1);
    }, 10000);

    return () => clearInterval(timer);
  }, [breakpointRuns.length]);

  // Helper: check if a breakpoint has been shown for longer than the staleness threshold
  const isStale = useCallback((runId: string): boolean => {
    const firstSeen = firstSeenRef.current.get(runId);
    if (!firstSeen) return false;
    return Date.now() - firstSeen > STALENESS_THRESHOLD_MS;
  }, []);

  // Auto-cleanup expired resolved entries
  useEffect(() => {
    if (resolvedEntries.length === 0) return;

    const timer = setInterval(() => {
      const now = Date.now();
      setResolvedEntries((prev) =>
        prev.filter((entry) => now - entry.resolvedAt < RESOLVED_DISPLAY_MS)
      );
    }, 1000);

    return () => clearInterval(timer);
  }, [resolvedEntries.length]);

  const visibleRuns = breakpointRuns.filter((bp) => !dismissedIds.has(bp.runId));
  const hasWaiting = visibleRuns.length > 0;
  const hasResolved = resolvedEntries.length > 0;

  if (!hasWaiting && !hasResolved) return null;

  return (
    <div role="alert" aria-live="assertive" aria-atomic="true" className="flex flex-col gap-2 mb-6" data-testid="breakpoint-banner">
      {/* Active breakpoints waiting */}
      {visibleRuns.map((bp) => {
        const stale = isStale(bp.runId);
        return (
          <BreakpointBannerItem
            key={bp.runId}
            bp={bp}
            stale={stale}
            onDismiss={() => dismissBreakpoint(bp.runId)}
          />
        );
      })}

      {/* Recently resolved breakpoints — green transient display */}
      {resolvedEntries.map((entry) => (
        <Link
          key={`resolved-${entry.bp.runId}`}
          href={`/runs/${entry.bp.runId}`}
          className={cn(
            "group relative flex items-center gap-3 px-4 py-3 rounded-lg",
            "bg-success-muted border border-success/30",
            "shadow-glow-success",
            "hover:border-success/50",
            "transition-colors cursor-pointer"
          )}
        >
          <div className="relative shrink-0">
            <CheckCircle2 className="h-5 w-5 text-success" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <CheckCircle2 className="h-3 w-3 text-success shrink-0" />
              <span className="text-xs font-bold text-success uppercase tracking-wider">
                Approved
              </span>
              <span className="text-xs text-foreground-muted font-medium">
                {entry.bp.projectName}
              </span>
              <span className="font-mono text-xs text-info">
                {entry.bp.runId.slice(0, 8)}
              </span>
            </div>
            <p className="text-sm text-foreground-muted truncate">
              {entry.bp.breakpointQuestion}
            </p>
          </div>
        </Link>
      ))}

      {/* Summary count when multiple waiting breakpoints */}
      {visibleRuns.length > 1 && (
        <div className="flex items-center gap-2 px-3 py-1">
          <Hand className="h-3.5 w-3.5 text-warning" />
          <span className="text-xs font-semibold text-warning">
            {visibleRuns.length} approvals pending
          </span>
        </div>
      )}
    </div>
  );
}
