"use client";
import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";
import {
  useNotifications,
  type AppNotification,
} from "@/hooks/use-notifications";
import { ToastStack } from "./toast-stack";
import { usePolling } from "@/hooks/use-polling";
import { formatShortId } from "@/lib/utils";
import type { DigestResponse } from "@/types";

interface NotificationContextValue {
  notify: (
    title: string,
    body: string,
    type?: AppNotification["type"],
    href?: string,
  ) => void;
  requestPermission: () => void;
  permission: NotificationPermission;
  notifications: AppNotification[];
  dismiss: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextValue>({
  notify: () => {},
  requestPermission: () => {},
  permission: "default",
  notifications: [],
  dismiss: () => {},
});

export const useNotificationContext = () => useContext(NotificationContext);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { notifications, notify, dismiss, requestPermission, permission } =
    useNotifications();
  const { data: digest } = usePolling<DigestResponse>("/api/digest", {
    interval: 3000,
  });
  const prevDigestRef = useRef<DigestResponse | null>(null);

  useEffect(() => {
    if (!digest || !prevDigestRef.current) {
      prevDigestRef.current = digest;
      return;
    }

    const prev = prevDigestRef.current;
    const prevMap = new Map(prev.runs.map((r) => [r.runId, r]));

    for (const run of digest.runs) {
      const prevRun = prevMap.get(run.runId);
      if (!prevRun) {
        notify(
          "New Run Started",
          `${formatShortId(run.runId, 4)} started`,
          "info",
          `/runs/${run.runId}`,
        );
        continue;
      }

      // Run completed
      if (run.status === "completed" && prevRun.status !== "completed") {
        notify(
          "Run Completed",
          `${formatShortId(run.runId, 4)} finished successfully`,
          "success",
          `/runs/${run.runId}`,
        );
      }

      // Run failed
      if (run.status === "failed" && prevRun.status !== "failed") {
        notify(
          "Run Failed",
          `${formatShortId(run.runId, 4)} failed`,
          "error",
          `/runs/${run.runId}`,
        );
      }

      // New tasks completed
      if (run.completedTasks > prevRun.completedTasks) {
        const diff = run.completedTasks - prevRun.completedTasks;
        notify(
          "Tasks Completed",
          `${diff} task${diff > 1 ? "s" : ""} completed in ${formatShortId(run.runId, 4)}`,
          "info",
          `/runs/${run.runId}`,
        );
      }

      // Run transitioned to waiting (breakpoint hit)
      if (run.status === "waiting" && prevRun.status !== "waiting") {
        const breakpointTitle = run.breakpointQuestion || "Review required";
        notify(
          `Run ${formatShortId(run.runId, 4)} needs attention`,
          breakpointTitle,
          "warning",
          `/runs/${run.runId}`,
        );
      }
    }

    prevDigestRef.current = digest;
  }, [digest, notify]);

  return (
    <NotificationContext.Provider
      value={{ notify, requestPermission, permission, notifications, dismiss }}
    >
      {children}
      <ToastStack notifications={notifications} onDismiss={dismiss} />
    </NotificationContext.Provider>
  );
}
