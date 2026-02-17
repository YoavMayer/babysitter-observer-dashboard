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
  const initRef = useRef(false);
  // Cooldown: track last notification time per run+type to prevent spam
  const cooldownRef = useRef<Map<string, number>>(new Map());
  const COOLDOWN_MS = 30000; // 30 seconds between same notification type per run

  useEffect(() => {
    if (!digest) return;

    // Skip notifications on first two digest loads (initial cache population)
    if (!prevDigestRef.current) {
      prevDigestRef.current = digest;
      return;
    }
    if (!initRef.current) {
      initRef.current = true;
      prevDigestRef.current = digest;
      return;
    }

    const prev = prevDigestRef.current;
    const prevMap = new Map(prev.runs.map((r) => [r.runId, r]));
    const now = Date.now();

    const throttledNotify = (
      key: string,
      title: string,
      body: string,
      type?: AppNotification["type"],
      href?: string,
    ) => {
      const lastTime = cooldownRef.current.get(key) || 0;
      if (now - lastTime < COOLDOWN_MS) return;
      cooldownRef.current.set(key, now);
      notify(title, body, type, href);
    };

    for (const run of digest.runs) {
      const prevRun = prevMap.get(run.runId);
      if (!prevRun) {
        throttledNotify(
          `${run.runId}:new`,
          "New Run Started",
          `${formatShortId(run.runId, 4)} started`,
          "info",
          `/runs/${run.runId}`,
        );
        continue;
      }

      // Run completed
      if (run.status === "completed" && prevRun.status !== "completed") {
        throttledNotify(
          `${run.runId}:completed`,
          "Run Completed",
          `${formatShortId(run.runId, 4)} finished successfully`,
          "success",
          `/runs/${run.runId}`,
        );
      }

      // Run failed
      if (run.status === "failed" && prevRun.status !== "failed") {
        throttledNotify(
          `${run.runId}:failed`,
          "Run Failed",
          `${formatShortId(run.runId, 4)} failed`,
          "error",
          `/runs/${run.runId}`,
        );
      }

      // New tasks completed — only notify for significant changes (not every single task)
      if (run.completedTasks > prevRun.completedTasks) {
        const diff = run.completedTasks - prevRun.completedTasks;
        throttledNotify(
          `${run.runId}:tasks`,
          "Tasks Completed",
          `${diff} task${diff > 1 ? "s" : ""} completed in ${formatShortId(run.runId, 4)}`,
          "info",
          `/runs/${run.runId}`,
        );
      }

      // Run transitioned to waiting (breakpoint hit)
      if (run.status === "waiting" && prevRun.status !== "waiting") {
        const breakpointTitle = run.breakpointQuestion || "Review required";
        throttledNotify(
          `${run.runId}:waiting`,
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
