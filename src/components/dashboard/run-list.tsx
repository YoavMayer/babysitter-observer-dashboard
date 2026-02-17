"use client";
import { useState } from "react";
import { RunCard } from "./run-card";
import { ProjectSection } from "./project-section";
import { EmptyState } from "@/components/shared/empty-state";
import type { Run } from "@/types";

interface RunListProps {
  runs: Run[];
  selectedIndex?: number;
  groupByProject?: boolean;
}

export function RunList({ runs, selectedIndex, groupByProject = false }: RunListProps) {
  const [pageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(0);

  if (runs.length === 0) {
    return <EmptyState />;
  }

  if (groupByProject) {
    // Group runs by projectName
    const grouped = runs.reduce((acc, run) => {
      const project = run.projectName || "Unknown Project";
      if (!acc[project]) {
        acc[project] = [];
      }
      acc[project].push(run);
      return acc;
    }, {} as Record<string, Run[]>);

    const projectEntries = Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b));

    return (
      <div className="flex flex-col gap-3">
        {projectEntries.map(([projectName, projectRuns]) => {
          const hasActiveRuns = projectRuns.some(r => r.status === "waiting" || r.status === "pending");
          return (
            <ProjectSection
              key={projectName}
              projectName={projectName}
              runs={projectRuns}
              defaultExpanded={hasActiveRuns}
            />
          );
        })}
      </div>
    );
  }

  // Flat list with pagination
  const totalPages = Math.ceil(runs.length / pageSize);
  const displayedRuns = runs.slice(0, (currentPage + 1) * pageSize);
  const hasMore = displayedRuns.length < runs.length;

  return (
    <div className="flex flex-col gap-2">
      {displayedRuns.map((run, i) => (
        <RunCard key={run.runId} run={run} selected={i === selectedIndex} />
      ))}
      {hasMore && (
        <button
          onClick={() => setCurrentPage(currentPage + 1)}
          className="mt-2 px-4 py-2 text-sm text-foreground-secondary hover:text-foreground hover:bg-background-secondary transition-colors rounded-md"
        >
          Show more ({runs.length - displayedRuns.length} remaining)
        </button>
      )}
    </div>
  );
}
