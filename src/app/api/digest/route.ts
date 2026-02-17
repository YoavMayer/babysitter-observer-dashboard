import { NextResponse } from "next/server";
import { discoverAllRunDirs } from "@/lib/config";
import { getRunDigest } from "@/lib/parser";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const allRuns = await discoverAllRunDirs();

    const runs = await Promise.all(
      allRuns.map(async ({ runDir, source, projectName }) => {
        const digest = await getRunDigest(runDir);
        digest.sourceLabel = source.label || source.path;
        digest.projectName = projectName;
        return digest;
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
