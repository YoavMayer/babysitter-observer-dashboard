"use client";
import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useRunDetail } from "@/hooks/use-run-detail";
import { useKeyboard } from "@/hooks/use-keyboard";
import { PipelineView } from "@/components/pipeline/pipeline-view";
import { EventStream } from "@/components/events/event-stream";
import { TaskDetailPanel } from "@/components/details/task-detail";
import { OutcomeBanner } from "@/components/shared/outcome-banner";
import { MetricsRow } from "@/components/shared/metrics-row";
import { useNotificationContext } from "@/components/notifications/notification-provider";
import { cn } from "@/lib/cn";
import { Loader2, X, ArrowLeft } from "lucide-react";
import type { JournalEvent, EffectRequestedPayload } from "@/types";

export default function RunDetailPage({ params }: { params: { runId: string } }) {
  const { runId } = params;
  const router = useRouter();
  const { run, loading, error, hasBreakpointWaiting } = useRunDetail(runId);
  const { notifications, dismiss, notify } = useNotificationContext();
  const [selectedEffectId, setSelectedEffectId] = useState<string | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [showEventStream, setShowEventStream] = useState(true);
  const [activeTab, setActiveTab] = useState("agent");

  const handleSelectEffect = useCallback((effectId: string) => {
    setSelectedEffectId(effectId);
    setShowDetail(true);

    // Auto-switch to breakpoint tab when selecting a breakpoint task
    const task = run?.tasks.find((t) => t.effectId === effectId);
    if (task?.kind === "breakpoint") {
      setActiveTab("breakpoint");
    }
  }, [run?.tasks]);

  const handleEventClick = useCallback((event: JournalEvent) => {
    const payload = event.payload as unknown as EffectRequestedPayload;
    if (payload?.effectId) {
      handleSelectEffect(payload.effectId);
    }
  }, [handleSelectEffect]);

  const tasks = useMemo(() => run?.tasks || [], [run?.tasks]);

  // Determine if the currently selected task is a waiting breakpoint
  const selectedTask = useMemo(() => {
    if (!selectedEffectId) return null;
    return tasks.find((t) => t.effectId === selectedEffectId) || null;
  }, [tasks, selectedEffectId]);

  const moveDown = useCallback(() => {
    if (!tasks.length) return;
    const currentIdx = selectedEffectId
      ? tasks.findIndex((t) => t.effectId === selectedEffectId)
      : -1;
    const nextIdx = Math.min(currentIdx + 1, tasks.length - 1);
    handleSelectEffect(tasks[nextIdx].effectId);
  }, [tasks, selectedEffectId]);

  const moveUp = useCallback(() => {
    if (!tasks.length) return;
    const currentIdx = selectedEffectId
      ? tasks.findIndex((t) => t.effectId === selectedEffectId)
      : tasks.length;
    const prevIdx = Math.max(currentIdx - 1, 0);
    handleSelectEffect(tasks[prevIdx].effectId);
  }, [tasks, selectedEffectId]);

  const goBack = useCallback(() => {
    if (showDetail) {
      setShowDetail(false);
      setSelectedEffectId(null);
    } else {
      router.push("/");
    }
  }, [showDetail, router]);

  const toggleEventStream = useCallback(() => {
    setShowEventStream((v) => !v);
  }, []);

  const tabKeys: Record<string, string> = {
    "1": "agent",
    "2": "timing",
    "3": "logs",
    "4": "data",
    "5": "breakpoint",
  };

  const switchTab = useCallback((key: string) => {
    const tab = tabKeys[key];
    if (tab) {
      // Only allow breakpoint tab if the selected task is a breakpoint
      if (tab === "breakpoint" && selectedTask?.kind !== "breakpoint") return;
      setActiveTab(tab);
    }
  }, [selectedTask]);

  useKeyboard([
    { key: "j", action: moveDown, description: "Next item" },
    { key: "k", action: moveUp, description: "Previous item" },
    { key: "Escape", action: goBack, description: "Go back / Close" },
    { key: "e", action: toggleEventStream, description: "Toggle event stream" },
    { key: "1", action: () => switchTab("1"), description: "Agent tab" },
    { key: "2", action: () => switchTab("2"), description: "Timing tab" },
    { key: "3", action: () => switchTab("3"), description: "Logs tab" },
    { key: "4", action: () => switchTab("4"), description: "Data tab" },
    { key: "5", action: () => switchTab("5"), description: "Breakpoint tab" },
  ]);

  if (loading && !run) {
    return (
      <div className="flex items-center justify-center flex-1">
        <Loader2 className="h-6 w-6 animate-spin text-foreground-muted" />
      </div>
    );
  }

  if (error || !run) {
    return (
      <div className="flex items-center justify-center flex-1">
        <div data-testid="run-error-message" className="rounded-lg border border-error/20 bg-error-muted p-4 text-sm text-error">
          {error || "Run not found"}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 bg-background">
      {/* Navigation header with back button */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-background-secondary/40">
        <button
          onClick={() => router.push("/")}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs font-medium text-foreground-muted hover:text-foreground hover:border-primary/50 hover:shadow-neon-glow-primary-ring transition-all duration-200"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Dashboard
        </button>
        <span className="text-xs text-foreground-muted">/</span>
        <span className="text-xs font-mono text-foreground-secondary">{run.runId.slice(0, 8)}...</span>
        {run.processId && (
          <>
            <span className="text-xs text-foreground-muted">/</span>
            <span className="text-xs text-foreground-secondary">{run.processId}</span>
          </>
        )}
      </div>

      {/* Outcome Banner - Top of page */}
      <OutcomeBanner run={run} />

      {/* Metrics Row - Summary stats for all run statuses */}
      <MetricsRow run={run} />

      <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
        {/* Pipeline - Left panel */}
        <div className={cn(
          "border-b lg:border-b-0 lg:border-r border-border transition-panel bg-card/50 backdrop-blur-sm",
          showDetail ? "lg:w-[35%]" : showEventStream ? "lg:w-[60%]" : "w-full",
        )}>
          <PipelineView
            run={run}
            selectedEffectId={selectedEffectId}
            onSelectEffect={handleSelectEffect}
            runStatus={run.status}
          />
        </div>

        {/* Task Detail - Center panel (shown when task selected) */}
        {showDetail && (
          <div className={cn(
            "border-b lg:border-b-0 lg:border-r border-border transition-panel bg-card/50 backdrop-blur-sm overflow-hidden flex flex-col",
            showEventStream ? "lg:w-[30%]" : "lg:w-[65%]",
          )}>
            <div data-testid="task-detail-header" className="flex items-center justify-between p-3 border-b border-border bg-background-secondary/40">
              <h3 className="text-xs font-medium text-foreground-muted uppercase tracking-wider">Task Detail</h3>
              <button
                data-testid="close-detail-btn"
                onClick={() => { setShowDetail(false); setSelectedEffectId(null); }}
                className="inline-flex items-center gap-1.5 rounded-md border border-primary/20 px-2.5 py-1 text-xs font-medium text-foreground-muted hover:text-primary hover:border-primary/50 hover:shadow-neon-glow-primary-ring transition-all duration-200"
              >
                <X className="h-3.5 w-3.5" />
                Close
              </button>
            </div>
            <TaskDetailPanel
              runId={runId}
              effectId={selectedEffectId}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              runDuration={run.duration}
              allTasks={run.tasks}
            />
          </div>
        )}

        {/* Event Stream - Right panel */}
        {showEventStream && (
          <div className={cn(
            "transition-panel bg-card/50 backdrop-blur-sm",
            showDetail ? "lg:w-[35%]" : "lg:w-[40%]",
          )}>
            <EventStream events={run.events} onEventClick={handleEventClick} />
          </div>
        )}
      </div>

    </div>
  );
}
