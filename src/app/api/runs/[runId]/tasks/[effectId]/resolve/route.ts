import { NextResponse } from "next/server";
import { findRunDir } from "@/lib/config";
import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { execFile } from "child_process";
import { promisify } from "util";
import type { BreakpointResolveRequest } from "@/types/breakpoint";
import { normalizeError } from "@/lib/error-handler";

export const dynamic = "force-dynamic";

const execFileAsync = promisify(execFile);

function isValidId(id: string): boolean {
  return /^[a-zA-Z0-9_\-]+$/.test(id);
}

export async function POST(
  request: Request,
  { params }: { params: { runId: string; effectId: string } }
) {
  let tmpFile: string | null = null;

  try {
    const { runId, effectId } = params;
    if (!isValidId(runId) || !isValidId(effectId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const found = await findRunDir(runId);
    if (!found) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }

    // Parse and validate request body
    const body: BreakpointResolveRequest = await request.json();
    if (typeof body.approved !== "boolean") {
      return NextResponse.json(
        { error: "Missing or invalid 'approved' field" },
        { status: 400 }
      );
    }

    const { runDir } = found;

    // Check if already resolved
    const resultPath = path.join(runDir, "tasks", effectId, "result.json");
    try {
      await fs.access(resultPath);
      return NextResponse.json(
        { error: "Task already resolved" },
        { status: 409 }
      );
    } catch {
      // result.json does not exist — good, continue
    }

    // Build resolution payload
    const status = body.approved ? "ok" : "error";
    const resolution = body.approved
      ? { approved: true, feedback: body.value }
      : { approved: false, error: body.value || "Rejected by user" };

    // Write temp file with resolution
    tmpFile = path.join(
      os.tmpdir(),
      `breakpoint-resolve-${runId}-${effectId}-${Date.now()}.json`
    );
    await fs.writeFile(tmpFile, JSON.stringify(resolution), "utf-8");

    // Execute babysitter CLI
    const args = [
      "task:post",
      runDir,
      effectId,
      "--status",
      status,
      "--value",
      tmpFile,
      "--json",
    ];

    const cli = process.env.BABYSITTER_CLI || "babysitter";
    await execFileAsync(cli, args, {
      timeout: 30000,
      env: { ...process.env },
    });

    return NextResponse.json(
      { success: true },
      { headers: { "Cache-Control": "no-cache, no-store" } }
    );
  } catch (error) {
    console.error("Failed to resolve breakpoint:", error);
    const normalized = normalizeError(error);
    return NextResponse.json(
      { error: normalized.message, code: normalized.code },
      { status: normalized.status }
    );
  } finally {
    // Clean up temp file
    if (tmpFile) {
      try {
        await fs.unlink(tmpFile);
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}
