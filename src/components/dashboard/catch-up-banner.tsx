"use client";
import { RefreshCw, Inbox } from "lucide-react";
import { cn } from "@/lib/cn";
import type { CatchUpState } from "@/hooks/use-batched-updates";

export interface CatchUpBannerProps {
  catchUp: CatchUpState;
}

/**
 * Subtle notification shown when the dashboard detects a burst of SSE updates
 * (catch-up mode). Displays the number of buffered updates and a "refresh now"
 * button to immediately apply all pending changes.
 */
export function CatchUpBanner({ catchUp }: CatchUpBannerProps) {
  if (!catchUp.active) return null;

  return (
    <div
      data-testid="catch-up-banner"
      className={cn(
        "flex items-center gap-3 px-4 py-2.5 mb-4 rounded-lg",
        "bg-info-muted border border-info/20",
        "animate-in fade-in slide-in-from-top-2 duration-300"
      )}
    >
      <div className="rounded-md p-1.5 bg-info/10">
        <Inbox className="h-4 w-4 text-info" />
      </div>
      <p className="flex-1 text-sm text-foreground">
        <span className="font-semibold tabular-nums">{catchUp.bufferedCount}</span>
        {" "}runs updated while you were away
      </p>
      <button
        onClick={catchUp.flush}
        data-testid="catch-up-refresh-btn"
        className={cn(
          "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold",
          "bg-info/10 border border-info/20 text-info",
          "hover:bg-info/20 transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info/50"
        )}
      >
        <RefreshCw className="h-3 w-3" />
        Refresh now
      </button>
    </div>
  );
}
