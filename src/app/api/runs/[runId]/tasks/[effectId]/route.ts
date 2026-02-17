import { NextResponse } from "next/server";
import { findRunDir } from "@/lib/config";
import { parseTaskDetail } from "@/lib/parser";

export const dynamic = "force-dynamic";

function isValidId(id: string): boolean {
  return /^[a-zA-Z0-9_\-]+$/.test(id);
}

export async function GET(
  _request: Request,
  { params }: { params: { runId: string; effectId: string } }
) {
  try {
    const { runId, effectId } = params;
    if (!isValidId(runId) || !isValidId(effectId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const found = await findRunDir(runId);
    if (!found) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }

    const task = await parseTaskDetail(found.runDir, effectId);

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    return NextResponse.json({ task }, {
      headers: { "Cache-Control": "no-cache, no-store" },
    });
  } catch (error) {
    console.error("Failed to read task:", error);
    return NextResponse.json(
      { error: "Failed to read task" },
      { status: 500 }
    );
  }
}
