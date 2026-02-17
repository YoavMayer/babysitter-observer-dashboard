"use client";
import { useMemo } from "react";
import { useSmartPolling } from "./use-smart-polling";
import type { RunDetailResponse, TaskDetailResponse } from "@/types";

export function useRunDetail(runId: string, interval = 3000) {
  const { data, loading, error, refresh } = useSmartPolling<RunDetailResponse>(
    `/api/runs/${runId}?maxEvents=50`,
    {
      interval,
      sseFilter: (event) => event.runId === runId // Only refetch for this run's updates
    }
  );

  const run = data?.run || null;

  // Detect if any breakpoint tasks are waiting for approval
  const hasBreakpointWaiting = useMemo(() => {
    if (!run) return false;
    return run.tasks.some(
      (t) => t.kind === "breakpoint" && t.status === "requested"
    );
  }, [run]);

  return {
    run,
    loading,
    error,
    refresh,
    hasBreakpointWaiting,
  };
}

export function useTaskDetail(runId: string, effectId: string | null) {
  const { data, loading, error } = useSmartPolling<TaskDetailResponse>(
    effectId ? `/api/runs/${runId}/tasks/${effectId}` : "",
    {
      enabled: !!effectId,
      interval: 5000,
      sseFilter: (event) => event.runId === runId,
    }
  );
  return {
    task: data?.task || null,
    loading,
    error,
  };
}
