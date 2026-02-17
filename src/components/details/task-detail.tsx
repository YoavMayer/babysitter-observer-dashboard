"use client";
import type { MutableRefObject } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AgentPanel } from "./agent-panel";
import { TimingPanel } from "./timing-panel";
import { LogViewer } from "./log-viewer";
import { JsonTree } from "./json-tree";
import { BreakpointPanel } from "@/components/breakpoint/breakpoint-panel";
import { useTaskDetail } from "@/hooks/use-run-detail";
import { Loader2, Hand } from "lucide-react";

export interface BreakpointPanelHandle {
  triggerApprove: () => void;
  triggerReject: () => void;
}

interface TaskDetailPanelProps {
  runId: string;
  effectId: string | null;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  breakpointPanelRef?: MutableRefObject<BreakpointPanelHandle | null>;
  onBreakpointResolved?: (approved: boolean) => void;
  runDuration?: number;
  allTasks?: import("@/types").TaskEffect[];
}

export function TaskDetailPanel({ runId, effectId, activeTab, onTabChange, breakpointPanelRef, onBreakpointResolved, runDuration, allTasks }: TaskDetailPanelProps) {
  const { task, loading } = useTaskDetail(runId, effectId);

  if (!effectId) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-foreground-muted">
        Click a task to view details
      </div>
    );
  }

  if (loading && !task) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-5 w-5 animate-spin text-foreground-muted" />
      </div>
    );
  }

  const isBreakpoint = task?.kind === "breakpoint";
  const defaultTab = isBreakpoint ? "breakpoint" : "agent";

  return (
    <Tabs data-testid="task-detail-tabs" value={activeTab} onValueChange={onTabChange} defaultValue={defaultTab} className="h-full flex flex-col">
      <TabsList className="shrink-0 mx-4 mt-3">
        {isBreakpoint && (
          <TabsTrigger value="breakpoint" className="gap-1">
            <Hand className="h-3 w-3" />
            Breakpoint
          </TabsTrigger>
        )}
        <TabsTrigger value="agent">Agent</TabsTrigger>
        <TabsTrigger value="timing">Timing</TabsTrigger>
        <TabsTrigger value="logs">Logs</TabsTrigger>
        <TabsTrigger value="data">Data</TabsTrigger>
      </TabsList>
      <div className="flex-1 overflow-y-auto">
        {isBreakpoint && task && (
          <TabsContent value="breakpoint">
            <BreakpointPanel
              task={task}
              runId={runId}
              onResolved={onBreakpointResolved}
              imperativeRef={breakpointPanelRef}
            />
          </TabsContent>
        )}
        <TabsContent value="agent"><AgentPanel task={task} /></TabsContent>
        <TabsContent value="timing"><TimingPanel task={task} runDuration={runDuration} allTasks={allTasks} /></TabsContent>
        <TabsContent value="logs"><LogViewer task={task} /></TabsContent>
        <TabsContent value="data"><JsonTree task={task} /></TabsContent>
      </div>
    </Tabs>
  );
}
