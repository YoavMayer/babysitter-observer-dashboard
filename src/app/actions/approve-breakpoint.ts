"use server";

import { promises as fs } from "fs";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { findRunDir } from "@/lib/path-resolver";

const execFileAsync = promisify(execFile);

export interface ApproveBreakpointResult {
  success: boolean;
  error?: string;
}

/**
 * Server Action: approve a stale breakpoint by writing output.json and invoking
 * the babysitter CLI to post the task result.
 *
 * This is a Next.js Server Action (form action) — NOT a REST endpoint.
 * After the file is written, the existing fs.watch -> SSE -> client flow
 * will detect the change and update the UI automatically.
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

    // --- Write output.json ---
    const outputPayload = {
      answer: answer.trim(),
      approvedAt: new Date().toISOString(),
      approvedBy: "observer-dashboard",
    };
    const outputPath = path.join(taskDir, "output.json");
    await fs.writeFile(outputPath, JSON.stringify(outputPayload, null, 2), "utf-8");

    // --- Invoke babysitter CLI to post the result ---
    const valueRelPath = path.join("tasks", effectId, "output.json");
    try {
      await execFileAsync("babysitter", [
        "task:post",
        runDir,
        effectId,
        "--status",
        "ok",
        "--value",
        valueRelPath,
      ], {
        timeout: 30000,
        cwd: runDir,
      });
    } catch (cliError: unknown) {
      const msg = cliError instanceof Error ? cliError.message : String(cliError);
      // The output.json was already written; the CLI failure is non-fatal
      // because the watcher will still detect the file change. But we report it.
      return {
        success: false,
        error: `output.json written but babysitter CLI failed: ${msg}`,
      };
    }

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}
