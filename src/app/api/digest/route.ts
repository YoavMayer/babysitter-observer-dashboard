import { NextResponse } from "next/server";
import { discoverAllRunDirs } from "@/lib/config";
import { ensureInitialized } from "@/lib/server-init";
import { getDigestCached, discoverAndCacheAll } from "@/lib/run-cache";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureInitialized();

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
    return NextResponse.json(
      { error: "Failed to read runs" },
      { status: 500 }
    );
  }
}
