"use client";
import { useMemo } from "react";
import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { cn } from "@/lib/cn";

export interface ExecutiveSummaryMetrics {
  totalProjects: number;
  activeRuns: number;
  failedRuns: number;
  completedRuns: number;
  staleRuns: number;
  pendingBreakpoints: number;
}

type SeverityLevel = "healthy" | "amber" | "red";

interface SummaryResult {
  severity: SeverityLevel;
  text: string;
  icon: React.ReactNode;
}

function deriveSummary(m: ExecutiveSummaryMetrics): SummaryResult {
  const issues: string[] = [];
  let severity: SeverityLevel = "healthy";

  // Red-level issues
  if (m.failedRuns > 0) {
    issues.push(
      `${m.failedRuns} run${m.failedRuns !== 1 ? "s" : ""} failing`
    );
    severity = "red";
  }

  // Amber-level issues
  if (m.pendingBreakpoints > 0) {
    issues.push(
      `${m.pendingBreakpoints} approval${m.pendingBreakpoints !== 1 ? "s" : ""} need${m.pendingBreakpoints === 1 ? "s" : ""} your attention`
    );
    if (severity !== "red") severity = "amber";
  }

  if (m.staleRuns > 0) {
    issues.push(
      `${m.staleRuns} stale run${m.staleRuns !== 1 ? "s" : ""}`
    );
    if (severity !== "red") severity = "amber";
  }

  // Healthy
  if (issues.length === 0) {
    const projectLabel = m.totalProjects === 1 ? "project" : "projects";
    const text =
      m.activeRuns > 0
        ? `All ${m.totalProjects} ${projectLabel} healthy \u2014 ${m.activeRuns} run${m.activeRuns !== 1 ? "s" : ""} in progress`
        : `All ${m.totalProjects} ${projectLabel} healthy`;
    return {
      severity: "healthy",
      text,
      icon: <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />,
    };
  }

  const text = issues.join(", ");
  const icon =
    severity === "red" ? (
      <XCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
    ) : (
      <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
    );

  return { severity, text, icon };
}

const severityStyles: Record<
  SeverityLevel,
  { container: string; text: string; iconColor: string }
> = {
  healthy: {
    container:
      "border-success/25 bg-success-muted shadow-neon-glow-success-sm",
    text: "text-success",
    iconColor: "text-success",
  },
  amber: {
    container:
      "border-warning/25 bg-warning-muted shadow-neon-glow-warning-sm",
    text: "text-warning",
    iconColor: "text-warning",
  },
  red: {
    container: "border-error/25 bg-error-muted shadow-neon-glow-error-sm",
    text: "text-error",
    iconColor: "text-error",
  },
};

interface ExecutiveSummaryBannerProps {
  metrics: ExecutiveSummaryMetrics;
}

export function ExecutiveSummaryBanner({
  metrics,
}: ExecutiveSummaryBannerProps) {
  const summary = useMemo(() => deriveSummary(metrics), [metrics]);
  const styles = severityStyles[summary.severity];

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      data-testid="executive-summary-banner"
      className={cn(
        "flex items-center gap-2.5 rounded-lg border px-4 py-2.5 mb-6",
        "backdrop-blur-sm transition-all duration-300",
        styles.container
      )}
    >
      <span className={styles.iconColor}>{summary.icon}</span>
      <p
        className={cn(
          "text-sm font-medium leading-snug",
          styles.text
        )}
      >
        {summary.text}
      </p>
    </div>
  );
}
