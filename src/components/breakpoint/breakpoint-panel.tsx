"use client";
import { useState, useCallback } from "react";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FilePreview } from "./file-preview";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Hand, CheckCircle2, XCircle, Loader2, AlertCircle } from "lucide-react";
import { TruncatedId } from "@/components/shared/truncated-id";
import { useBreakpointResolve } from "@/hooks/use-breakpoint-resolve";
import type { TaskDetail } from "@/types";

type ConfirmAction = "approve" | "reject" | null;

interface BreakpointPanelProps {
  task: TaskDetail;
  runId: string;
}

export function BreakpointPanel({ task, runId }: BreakpointPanelProps) {
  const breakpoint = task.breakpoint;
  const question = breakpoint?.question || task.breakpointQuestion || "Approval required";
  const title = breakpoint?.title || task.title || "Approval Required";
  const files = breakpoint?.context?.files || [];
  const isWaiting = task.status === "requested";

  const { resolve, loading, error, resolved, clearError } = useBreakpointResolve();
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [comment, setComment] = useState("");

  const handleApproveClick = useCallback(() => {
    if (confirmAction === "approve") {
      // Second click: execute the approval
      resolve(runId, task.effectId, true, comment || undefined);
      setConfirmAction(null);
    } else {
      // First click: enter confirmation mode
      setConfirmAction("approve");
      clearError();
    }
  }, [confirmAction, resolve, runId, task.effectId, comment, clearError]);

  const handleRejectClick = useCallback(() => {
    if (confirmAction === "reject") {
      // Second click: execute the rejection
      resolve(runId, task.effectId, false, comment || undefined);
      setConfirmAction(null);
    } else {
      // First click: enter confirmation mode
      setConfirmAction("reject");
      clearError();
    }
  }, [confirmAction, resolve, runId, task.effectId, comment, clearError]);

  const handleCancel = useCallback(() => {
    setConfirmAction(null);
  }, []);

  return (
    <ScrollArea className="h-full">
      <div className="space-y-5 p-4">
        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Hand className={cn("h-4 w-4 text-warning", isWaiting && "animate-pulse-dot")} />
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="warning">Approval Required</Badge>
            {task.status === "resolved" && (
              <Badge variant="success">Already Resolved</Badge>
            )}
          </div>
          <TruncatedId id={task.effectId} chars={4} className="text-foreground-muted" />
        </div>

        {/* Question callout — sun yellow border with warm glow */}
        <div
          role="alert"
          aria-live="assertive"
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
              <h4 className={cn(
                "text-xs leading-tight font-medium uppercase tracking-widest mb-2",
                isWaiting ? "text-warning" : "text-success"
              )}>
                {isWaiting ? "Your approval is needed" : "Decision made"}
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

        {/* Action buttons — only shown when waiting */}
        {isWaiting && !resolved && (
          <div className="space-y-4">
            {/* Optional comment textarea */}
            <div className="space-y-2">
              <label
                htmlFor="breakpoint-comment"
                className="text-xs font-medium text-foreground-muted uppercase tracking-wider"
              >
                Comment (optional)
              </label>
              <textarea
                id="breakpoint-comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Add a comment with your decision..."
                disabled={loading}
                className={cn(
                  "w-full min-h-[80px] rounded-lg border border-border bg-background p-3",
                  "text-sm text-foreground placeholder:text-foreground-muted/50",
                  "focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/30",
                  "resize-y transition-colors duration-200",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
              />
            </div>

            {/* Confirmation banner */}
            {confirmAction && !loading && (
              <div
                role="status"
                className={cn(
                  "rounded-lg border p-3 text-sm font-medium flex items-center justify-between",
                  confirmAction === "approve"
                    ? "bg-success-muted border-success/30 text-success"
                    : "bg-destructive/10 border-destructive/30 text-destructive"
                )}
              >
                <span>
                  {confirmAction === "approve"
                    ? "Click Approve again to confirm"
                    : "Click Reject again to confirm"}
                </span>
                <button
                  onClick={handleCancel}
                  className="text-xs underline hover:no-underline ml-2"
                >
                  Cancel
                </button>
              </div>
            )}

            {/* Error display */}
            {error && (
              <div
                role="alert"
                className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 flex items-center gap-2 text-sm text-destructive"
              >
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Approve / Reject buttons */}
            <div className="flex gap-3">
              <Button
                onClick={handleApproveClick}
                disabled={loading || confirmAction === "reject"}
                className={cn(
                  "flex-1 min-h-[44px] gap-2 text-sm font-semibold",
                  "bg-success text-success-foreground",
                  "hover:bg-success/90 hover:shadow-glow-success hover:scale-[1.02]",
                  "active:scale-[0.98]",
                  confirmAction === "approve" && "ring-2 ring-success ring-offset-2 ring-offset-background"
                )}
              >
                {loading && confirmAction === null ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-5 w-5" />
                )}
                {confirmAction === "approve" ? "Confirm Approve" : "Approve"}
              </Button>

              <Button
                onClick={handleRejectClick}
                disabled={loading || confirmAction === "approve"}
                variant="destructive"
                className={cn(
                  "flex-1 min-h-[44px] gap-2 text-sm font-semibold",
                  confirmAction === "reject" && "ring-2 ring-destructive ring-offset-2 ring-offset-background"
                )}
              >
                {loading && confirmAction === null ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <XCircle className="h-5 w-5" />
                )}
                {confirmAction === "reject" ? "Confirm Reject" : "Reject"}
              </Button>
            </div>
          </div>
        )}

        {/* Success state after resolution */}
        {isWaiting && resolved && (
          <div className="rounded-lg bg-success-muted border border-success/30 p-4 flex items-center gap-3 shadow-glow-success">
            <div className="flex items-center justify-center h-8 w-8 rounded-full bg-success/15">
              <CheckCircle2 className="h-5 w-5 text-success" />
            </div>
            <div>
              <span className="text-sm text-success font-semibold block">
                Decision submitted
              </span>
              <span className="text-xs leading-tight text-foreground-muted">
                Your approval has been submitted successfully
              </span>
            </div>
          </div>
        )}

        {/* Resolved state — neon green success glow */}
        {task.status === "resolved" && (
          <div className="rounded-lg bg-success-muted border border-success/30 p-4 flex items-center gap-3 shadow-glow-success">
            <div className="flex items-center justify-center h-8 w-8 rounded-full bg-success/15">
              <CheckCircle2 className="h-5 w-5 text-success" />
            </div>
            <div>
              <span className="text-sm text-success font-semibold block">
                Approved
              </span>
              <span className="text-xs leading-tight text-foreground-muted">
                Approval has been resolved
              </span>
            </div>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
