import { NextResponse } from "next/server";
import { ensureInitialized } from "@/lib/server-init";
import { getAllCachedDigests } from "@/lib/run-cache";
import { normalizeError } from "@/lib/error-handler";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    try {
      await ensureInitialized();
    } catch (initError) {
      console.error("Server initialization failed:", initError);
      return NextResponse.json(
        { error: "Server initialization failed. Check observer configuration and watch sources.", code: "INIT_FAILED" },
        { status: 500 }
      );
    }

    // Pure cache read — no filesystem scanning.
    // Cache is populated by server-init and kept fresh by the watcher + periodic discovery.
    const runs = getAllCachedDigests();

    // Sort by updatedAt descending (most recent first), with runId tiebreaker
    // to ensure stable ordering when multiple runs share the same timestamp.
    runs.sort((a, b) => {
      const cmp = (b.updatedAt || "").localeCompare(a.updatedAt || "");
      if (cmp !== 0) return cmp;
      return a.runId.localeCompare(b.runId);
    });

    return NextResponse.json({ runs }, {
      headers: { "Cache-Control": "no-cache, no-store" },
    });
  } catch (error) {
    console.error("Failed to read digest:", error);
    const normalized = normalizeError(error);
    return NextResponse.json(
      { error: normalized.message, code: normalized.code },
      { status: normalized.status }
    );
  }
}
