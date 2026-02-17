import { NextResponse } from "next/server";
import { findRunDir } from "@/lib/config";
import { ensureInitialized } from "@/lib/server-init";
import { getRunCached } from "@/lib/run-cache";
import { normalizeError } from "@/lib/error-handler";

export const dynamic = "force-dynamic";

function isValidId(id: string): boolean {
  return /^[a-zA-Z0-9_\-]+$/.test(id);
}

const DEFAULT_MAX_EVENTS = 50;

export async function GET(
  request: Request,
  { params }: { params: { runId: string } }
) {
  try {
    // Ensure watcher and cache are initialized
    await ensureInitialized();

    const { runId } = params;
    if (!isValidId(runId)) {
      return NextResponse.json({ error: "Invalid run ID" }, { status: 400 });
    }

    const found = await findRunDir(runId);
    if (!found) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }

    // Use cached run for better performance
    const run = await getRunCached(found.runDir, found.source, found.projectName);

    // Limit events returned (keep most recent) to reduce payload size
    const { searchParams } = new URL(request.url);
    const maxEvents = parseInt(searchParams.get("maxEvents") || String(DEFAULT_MAX_EVENTS));
    const totalEvents = run.events.length;
    const limitedRun = totalEvents > maxEvents
      ? { ...run, events: run.events.slice(-maxEvents), totalEvents }
      : { ...run, totalEvents };

    return NextResponse.json({ run: limitedRun }, {
      headers: { "Cache-Control": "no-cache, no-store" },
    });
  } catch (error) {
    console.error("Failed to read run:", error);
    const normalized = normalizeError(error);
    return NextResponse.json(
      { error: normalized.message, code: normalized.code },
      { status: normalized.status }
    );
  }
}
