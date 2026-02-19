"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { Hand, AlertTriangle, CheckCircle2 } from "lucide-react";
import type { BreakpointRunInfo } from "@/types";

interface ResolvedEntry {
  bp: BreakpointRunInfo;
  resolvedAt: number;
}

const RESOLVED_DISPLAY_MS = 20000; // 20 seconds

interface BreakpointBannerProps {
  breakpointRuns: BreakpointRunInfo[];
}

export function BreakpointBanner({ breakpointRuns }: BreakpointBannerProps) {
  const [resolvedEntries, setResolvedEntries] = useState<ResolvedEntry[]>([]);
  const prevRunIdsRef = useRef<Map<string, BreakpointRunInfo>>(new Map());

  // Detect resolved breakpoints: runs that were previously in the list but are now gone
  useEffect(() => {
    const currentIds = new Set(breakpointRuns.map((bp) => bp.runId));
    const now = Date.now();

    const newlyResolved: ResolvedEntry[] = [];
    for (const [runId, bp] of prevRunIdsRef.current) {
      if (!currentIds.has(runId)) {
        newlyResolved.push({ bp, resolvedAt: now });
      }
    }

    if (newlyResolved.length > 0) {
      setResolvedEntries((prev) => [...prev, ...newlyResolved]);
    }

    // Update prev ref
    prevRunIdsRef.current = new Map(breakpointRuns.map((bp) => [bp.runId, bp]));
  }, [breakpointRuns]);

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

  const hasWaiting = breakpointRuns.length > 0;
  const hasResolved = resolvedEntries.length > 0;

  if (!hasWaiting && !hasResolved) return null;

  return (
    <div className="flex flex-col gap-2 mb-6" data-testid="breakpoint-banner">
      {/* Active breakpoints waiting */}
      {breakpointRuns.map((bp) => (
        <Link
          key={bp.runId}
          href={`/runs/${bp.runId}`}
          className={cn(
            "group relative flex items-center gap-3 px-4 py-3 rounded-lg",
            "bg-warning-muted border border-warning/30",
            "shadow-breakpoint-glow animate-breakpoint-glow",
            "hover:border-warning/50 hover:bg-warning-muted",
            "transition-colors cursor-pointer"
          )}
        >
          <div className="relative shrink-0">
            <Hand className="h-5 w-5 text-warning animate-pulse-dot" />
            <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-warning animate-ping" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <AlertTriangle className="h-3 w-3 text-warning shrink-0" />
              <span className="text-xs font-bold text-warning uppercase tracking-wider">
                Breakpoint Waiting
              </span>
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
      ))}

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
                Breakpoint Resolved
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
      {breakpointRuns.length > 1 && (
        <div className="flex items-center gap-2 px-3 py-1">
          <Hand className="h-3.5 w-3.5 text-warning" />
          <span className="text-xs font-semibold text-warning">
            {breakpointRuns.length} breakpoints waiting for approval
          </span>
        </div>
      )}
    </div>
  );
}
