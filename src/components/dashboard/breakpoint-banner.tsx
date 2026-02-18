"use client";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { Hand, ExternalLink, AlertTriangle } from "lucide-react";
import type { BreakpointRunInfo } from "@/types";

interface BreakpointBannerProps {
  breakpointRuns: BreakpointRunInfo[];
}

export function BreakpointBanner({ breakpointRuns }: BreakpointBannerProps) {
  if (breakpointRuns.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 mb-6" data-testid="breakpoint-banner">
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
          {/* Pulsing icon */}
          <div className="relative shrink-0">
            <Hand className="h-5 w-5 text-warning animate-pulse-dot" />
            <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-warning animate-ping" />
          </div>

          {/* Content */}
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

          {/* Respond link indicator */}
          <div className={cn(
            "shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-md",
            "bg-warning/10 border border-warning/20",
            "text-xs font-medium text-warning",
            "group-hover:bg-warning/20 group-hover:border-warning/30 transition-colors"
          )}>
            Respond
            <ExternalLink className="h-3 w-3" />
          </div>
        </Link>
      ))}

      {/* Summary count when multiple breakpoints */}
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
