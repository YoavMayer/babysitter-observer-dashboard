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
    options?: { href?: string; persistent?: boolean },
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

// Watermark per run: tracks the highest-seen state so notifications only fire once
interface RunWatermark {
  status: string;
  completedTasks: number;
  pendingBreakpoints: number;
  notifiedCompleted: boolean;
  notifiedFailed: boolean;
  notifiedWaiting: boolean;
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { notifications, notify, dismiss, requestPermission, permission } =
    useNotifications();
  const { data: digest } = usePolling<DigestResponse>("/api/digest", {
    interval: 3000,
  });
  // Permanent watermark: tracks highest-seen state per run across all polls
  const watermarkRef = useRef<Map<string, RunWatermark>>(new Map());
  const initCountRef = useRef(0);
  const INIT_SKIP = 2; // Skip first 2 digest loads to seed watermarks

  useEffect(() => {
    if (!digest) return;

    const watermarks = watermarkRef.current;

    // Seed phase: populate watermarks without firing notifications
    if (initCountRef.current < INIT_SKIP) {
      initCountRef.current++;
      for (const run of digest.runs) {
        watermarks.set(run.runId, {
          status: run.status,
          completedTasks: run.completedTasks,
          pendingBreakpoints: run.pendingBreakpoints || 0,
          notifiedCompleted: run.status === "completed",
          notifiedFailed: run.status === "failed",
          notifiedWaiting: run.status === "waiting",
        });
      }
      return;
    }

    for (const run of digest.runs) {
      const wm = watermarks.get(run.runId);

      if (!wm) {
        // Genuinely new run — seed watermark and notify
        watermarks.set(run.runId, {
          status: run.status,
          completedTasks: run.completedTasks,
          pendingBreakpoints: run.pendingBreakpoints || 0,
          notifiedCompleted: run.status === "completed",
          notifiedFailed: run.status === "failed",
          notifiedWaiting: run.status === "waiting",
        });
        notify(
          "New Run Started",
          `${formatShortId(run.runId, 4)} started`,
          "info",
          { href: `/runs/${run.runId}` },
        );
        continue;
      }

      // Run completed — only notify once ever
      if (run.status === "completed" && !wm.notifiedCompleted) {
        wm.notifiedCompleted = true;
        notify(
          "Run Completed",
          `${formatShortId(run.runId, 4)} finished successfully`,
          "success",
          { href: `/runs/${run.runId}` },
        );
      }

      // Run failed — only notify once ever
      if (run.status === "failed" && !wm.notifiedFailed) {
        wm.notifiedFailed = true;
        notify(
          "Run Failed",
          `${formatShortId(run.runId, 4)} failed`,
          "error",
          { href: `/runs/${run.runId}` },
        );
      }

      // Tasks completed — only notify when count exceeds watermark
      if (run.completedTasks > wm.completedTasks) {
        const diff = run.completedTasks - wm.completedTasks;
        wm.completedTasks = run.completedTasks;
        notify(
          "Tasks Completed",
          `${diff} task${diff > 1 ? "s" : ""} completed in ${formatShortId(run.runId, 4)}`,
          "info",
          { href: `/runs/${run.runId}` },
        );
      }

      // Run transitioned to waiting (breakpoint) — only notify once per waiting episode
      if (run.status === "waiting" && !wm.notifiedWaiting) {
        wm.notifiedWaiting = true;
        const breakpointTitle = run.breakpointQuestion || "Review required";
        notify(
          `Run ${formatShortId(run.runId, 4)} needs attention`,
          breakpointTitle,
          "warning",
          { href: `/runs/${run.runId}`, persistent: true },
        );
      }

      // Reset waiting flag when run leaves waiting state (allows re-notification on next breakpoint)
      if (run.status !== "waiting" && wm.notifiedWaiting) {
        wm.notifiedWaiting = false;
      }

      // Breakpoint resolved — pending count dropped to zero
      if (wm.pendingBreakpoints > 0 && (run.pendingBreakpoints === 0 || run.pendingBreakpoints === undefined)) {
        notify(
          "Breakpoint Resolved",
          `Breakpoint in ${formatShortId(run.runId, 4)} was approved`,
          "success",
          { href: `/runs/${run.runId}` },
        );
      }
      wm.pendingBreakpoints = run.pendingBreakpoints || 0;

      wm.status = run.status;
    }
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
