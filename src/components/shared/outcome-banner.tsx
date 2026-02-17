import { CheckCircle2, XCircle } from "lucide-react";
import { formatDuration } from "@/lib/utils";
import type { Run } from "@/types";

interface OutcomeBannerProps {
  run: Run;
}

export function OutcomeBanner({ run }: OutcomeBannerProps) {
  if (run.status === "completed") {
    return (
      <div data-testid="outcome-banner" data-status="completed" className="bg-success-muted border-b-2 border-success/30 px-5 py-4 shadow-glow-success">
        <div className="flex items-center gap-3 text-success">
          <CheckCircle2 className="h-5 w-5 shrink-0 drop-shadow-[var(--drop-glow-success)]" />
          <span className="text-base font-medium">
            Completed in {formatDuration(run.duration)}
          </span>
        </div>
      </div>
    );
  }

  if (run.status === "failed") {
    const failedTask = run.tasks.find((t) => t.status === "error");
    const stepName = failedTask?.label || run.failedStep || "unknown step";
    const errorMessage = failedTask?.error?.message || "An error occurred";

    return (
      <div data-testid="outcome-banner" data-status="failed" className="bg-error-muted border-b-2 border-error/30 px-5 py-4 shadow-glow-error">
        <div className="flex items-center gap-3 text-error">
          <XCircle className="h-5 w-5 shrink-0 drop-shadow-[var(--drop-glow-error)]" />
          <span className="text-base font-medium">
            Failed at step: {stepName} &mdash; {errorMessage}
          </span>
        </div>
      </div>
    );
  }

  return null;
}
