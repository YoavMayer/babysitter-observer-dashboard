"use server";

import { promises as fs } from "fs";
import path from "path";
import { findRunDir } from "@/lib/path-resolver";

export interface ApproveBreakpointResult {
  success: boolean;
  error?: string;
}

/**
 * Server Action: approve a stale breakpoint by writing result.json directly
 * to the task directory. No CLI calls, no POST endpoints.
 *
 * For stale/abandoned breakpoints the orchestration session is gone,
 * so we write the SDK-compatible result.json ourselves. The existing
 * fs.watch -> SSE -> client flow detects the new file and updates the UI.
 */
export async function approveBreakpoint(
  runId: string,
  effectId: string,
  answer: string,
): Promise<ApproveBreakpointResult> {
  // --- Validate inputs ---
  if (!runId || typeof runId !== "string") {
    return { success: false, error: "Missing or invalid runId" };
  }
  if (!effectId || typeof effectId !== "string") {
    return { success: false, error: "Missing or invalid effectId" };
  }
  if (!answer || typeof answer !== "string" || answer.trim().length === 0) {
    return { success: false, error: "Answer cannot be empty" };
  }

  // Sanitize IDs to prevent path traversal
  const idPattern = /^[a-zA-Z0-9_\-]+$/;
  if (!idPattern.test(runId) || !idPattern.test(effectId)) {
    return { success: false, error: "Invalid characters in runId or effectId" };
  }

  try {
    // --- Resolve the run directory ---
    const found = await findRunDir(runId);
    if (!found) {
      return { success: false, error: `Run not found: ${runId}` };
    }
    const runDir = found.runDir;

    // --- Verify the task directory exists ---
    const taskDir = path.join(runDir, "tasks", effectId);
    try {
      await fs.access(taskDir);
    } catch {
      return { success: false, error: `Task directory not found: ${effectId}` };
    }

    // --- Write result.json directly (SDK-compatible format) ---
    const now = new Date().toISOString();
    const resultPayload = {
      status: "ok",
      value: {
        answer: answer.trim(),
        approvedAt: now,
        approvedBy: "observer-dashboard",
      },
      startedAt: now,
      finishedAt: now,
    };
    const resultPath = path.join(taskDir, "result.json");
    await fs.writeFile(resultPath, JSON.stringify(resultPayload, null, 2), "utf-8");

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}
