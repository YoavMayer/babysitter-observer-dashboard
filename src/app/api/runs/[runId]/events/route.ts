import { NextResponse } from "next/server";
import path from "path";
import { findRunDir } from "@/lib/config";
import { parseJournalDir } from "@/lib/parser";

export const dynamic = "force-dynamic";

function isValidId(id: string): boolean {
  return /^[a-zA-Z0-9_\-]+$/.test(id);
}

export async function GET(
  request: Request,
  { params }: { params: { runId: string } }
) {
  try {
    const { runId } = params;
    if (!isValidId(runId)) {
      return NextResponse.json({ error: "Invalid run ID" }, { status: 400 });
    }

    const found = await findRunDir(runId);
    if (!found) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }

    const journalPath = path.join(found.runDir, "journal");

    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get("limit") || "50", 10);
    const offset = parseInt(url.searchParams.get("offset") || "0", 10);

    const allEvents = await parseJournalDir(journalPath);
    const total = allEvents.length;
    const events = allEvents.slice(offset, offset + limit);

    return NextResponse.json({ events, total }, {
      headers: { "Cache-Control": "no-cache, no-store" },
    });
  } catch (error) {
    console.error("Failed to read events:", error);
    return NextResponse.json(
      { error: "Failed to read events" },
      { status: 500 }
    );
  }
}
