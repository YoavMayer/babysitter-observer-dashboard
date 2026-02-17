import { NextResponse } from "next/server";
import { discoverAllRunDirs } from "@/lib/config";
import { ensureInitialized } from "@/lib/server-init";
import { getDigestCached, discoverAndCacheAll } from "@/lib/run-cache";
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

    // Use cached digests for consistent, fast responses
    // This prevents notification spam from inconsistent fresh reads
    const allRuns = await discoverAllRunDirs();

    const runs = await Promise.all(
      allRuns.map(async ({ runDir, source, projectName }) => {
        return await getDigestCached(runDir, source, projectName);
      })
    );

    // Sort by updatedAt descending (most recent first)
    runs.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));

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
