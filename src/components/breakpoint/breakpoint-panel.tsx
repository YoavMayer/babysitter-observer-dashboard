"use client";
import { useState, useEffect, useCallback, type MutableRefObject } from "react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Kbd } from "@/components/shared/kbd";
import { FilePreview } from "./file-preview";
import { useBreakpointResolve } from "@/hooks/use-breakpoint-resolve";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Hand, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { TruncatedId } from "@/components/shared/truncated-id";
import type { TaskDetail } from "@/types";

interface BreakpointPanelHandle {
  triggerApprove: () => void;
  triggerReject: () => void;
}

interface BreakpointPanelProps {
  task: TaskDetail;
  runId: string;
  onResolved?: (approved: boolean) => void;
  imperativeRef?: MutableRefObject<BreakpointPanelHandle | null>;
}

type ConfirmTarget = "approve" | "reject" | null;

export function BreakpointPanel({ task, runId, onResolved, imperativeRef }: BreakpointPanelProps) {
  const { resolve, loading, error, resolved } = useBreakpointResolve();
  const [confirmTarget, setConfirmTarget] = useState<ConfirmTarget>(null);

  const breakpoint = task.breakpoint;
  const question = breakpoint?.question || task.breakpointQuestion || "Approval required";
  const title = breakpoint?.title || task.title || "Breakpoint";
  const files = breakpoint?.context?.files || [];
  const isWaiting = task.status === "requested" && !resolved;

  const handleAction = useCallback(async (approved: boolean) => {
    if (!isWaiting || loading) return;

    const target: ConfirmTarget = approved ? "approve" : "reject";

    // First click: show confirmation
    if (confirmTarget !== target) {
      setConfirmTarget(target);
      return;
    }

    // Second click: execute
    setConfirmTarget(null);
    try {
      await resolve(runId, task.effectId, approved);
      onResolved?.(approved);
    } catch {
      // Error is surfaced via the hook
    }
  }, [isWaiting, loading, confirmTarget, resolve, runId, task.effectId, onResolved]);

  // Expose imperative methods for keyboard shortcuts from parent
  useEffect(() => {
    if (imperativeRef) {
      imperativeRef.current = {
        triggerApprove: () => handleAction(true),
        triggerReject: () => handleAction(false),
      };
      return () => {
        imperativeRef.current = null;
      };
    }
  }, [imperativeRef, handleAction]);

  function handleBlur() {
    // Reset confirmation if user clicks away
    setConfirmTarget(null);
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-5 p-4">
        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Hand className="h-4 w-4 text-warning animate-pulse-dot" />
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="warning">Breakpoint</Badge>
            {resolved && (
              <Badge variant="success" className="shadow-glow-success">Resolved</Badge>
            )}
            {task.status === "resolved" && !resolved && (
              <Badge variant="success">Already Resolved</Badge>
            )}
          </div>
          <TruncatedId id={task.effectId} chars={4} className="text-foreground-muted" />
        </div>

        {/* Question callout — sun yellow border with warm glow */}
        <div
          className={cn(
            "rounded-lg border-2 p-5",
            "bg-warning-muted border-warning/40",
            isWaiting && "animate-breakpoint-glow"
          )}
          style={isWaiting ? { boxShadow: "var(--breakpoint-glow)" } : undefined}
        >
          <div className="flex items-start gap-3">
            <Hand className="h-6 w-6 text-warning shrink-0 mt-0.5 animate-pulse-dot" />
            <div className="min-w-0">
              <h4 className="text-[10px] leading-tight font-medium text-warning/80 uppercase tracking-widest mb-2">
                Awaiting decision
              </h4>
              <p className="text-base text-foreground font-medium leading-relaxed whitespace-pre-wrap break-words">
                {question}
              </p>
            </div>
          </div>
        </div>

        {/* Attached files */}
        {files.length > 0 && (
          <FilePreview files={files} runId={runId} effectId={task.effectId} />
        )}

        {/* Action buttons — neon glow states */}
        {isWaiting && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Button
                onClick={() => handleAction(true)}
                onBlur={handleBlur}
                disabled={loading}
                className={cn(
                  "flex-1 transition-all duration-200",
                  confirmTarget === "approve"
                    ? "bg-warning text-white hover:bg-warning/90 scale-[1.02] ring-2 ring-warning/30"
                    : "bg-success text-white hover:bg-success/90 hover:shadow-glow-success"
                )}
              >
                {loading && confirmTarget === "approve" ? (
                  <Loader2 className="h-4 w-4 animate-spin-smooth" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                {confirmTarget === "approve" ? "Confirm?" : "Approve"}
                <Kbd className="ml-1">a</Kbd>
              </Button>

              <Button
                variant="outline"
                onClick={() => handleAction(false)}
                onBlur={handleBlur}
                disabled={loading}
                className={cn(
                  "flex-1 transition-all duration-200",
                  confirmTarget === "reject"
                    ? "border-error text-error bg-error-muted hover:bg-error/20 scale-[1.02] ring-2 ring-error/30 shadow-glow-error"
                    : "hover:border-error hover:text-error hover:shadow-glow-error"
                )}
              >
                {loading && confirmTarget === "reject" ? (
                  <Loader2 className="h-4 w-4 animate-spin-smooth" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                {confirmTarget === "reject" ? "Confirm?" : "Reject"}
                <Kbd className="ml-1">r</Kbd>
              </Button>
            </div>

            <p className={cn(
              "text-[10px] leading-tight text-center transition-colors duration-200",
              confirmTarget ? "text-warning" : "text-foreground-muted"
            )}>
              {confirmTarget
                ? `Press ${confirmTarget === "approve" ? "'a'" : "'r'"} again or click to confirm`
                : "Press a/r or click, then confirm"}
            </p>
          </div>
        )}

        {/* Resolved state — neon green success glow */}
        {(resolved || task.status === "resolved") && (
          <div className="rounded-lg bg-success-muted border border-success/30 p-4 flex items-center gap-3 shadow-glow-success">
            <div className="flex items-center justify-center h-8 w-8 rounded-full bg-success/15">
              <CheckCircle2 className="h-5 w-5 text-success" />
            </div>
            <div>
              <span className="text-sm text-success font-semibold block">
                Approved
              </span>
              <span className="text-[10px] leading-tight text-foreground-muted">
                Breakpoint has been resolved
              </span>
            </div>
          </div>
        )}

        {/* Error display */}
        {error && (
          <div className="rounded-lg bg-error-muted border border-error/30 p-3 shadow-glow-error">
            <p className="text-sm text-error font-medium">{error}</p>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
