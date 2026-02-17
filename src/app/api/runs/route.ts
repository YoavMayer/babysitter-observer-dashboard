import { NextResponse } from "next/server";
import { discoverAllRunDirs, getConfig } from "@/lib/config";
import { ensureInitialized } from "@/lib/server-init";
import {
  getProjectSummaries,
  getRunCached,
  discoverAndCacheAll,
} from "@/lib/run-cache";
import { normalizeError } from "@/lib/error-handler";
import type { Run } from "@/types";

export const dynamic = "force-dynamic";

/**
 * Returns a numeric sort priority for a run:
 *   0 = Active non-stale (waiting/pending where !isStale) — shown first
 *   1 = Stale runs (isStale === true) — shown second
 *   2 = Failed runs — shown third
 *   3 = Completed runs — shown last
 */
function runSortPriority(run: Run): number {
  const isActive = run.status === "waiting" || run.status === "pending";
  if (isActive && !run.isStale) return 0;
  if (run.isStale) return 1;
  if (run.status === "failed") return 2;
  return 3;
}

export async function GET(request: Request) {
  try {
    // Ensure watcher and cache are initialized
    await ensureInitialized();

    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("mode");
    const project = searchParams.get("project");
    const limit = parseInt(searchParams.get("limit") || "0");
    const offset = parseInt(searchParams.get("offset") || "0");
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";

    // Mode: projects - return lightweight project summaries
    // Always re-discover to ensure all projects appear (debounced internally)
    if (mode === "projects") {
      await discoverAndCacheAll();
      const config = await getConfig();
      const projects = getProjectSummaries();

      // Apply retention filter: exclude projects whose latest update is older than retentionDays
      const retentionCutoff = Date.now() - config.retentionDays * 24 * 60 * 60 * 1000;
      const retainedProjects = projects.filter((p) =>
        // Always keep projects with active or stale runs regardless of age
        p.activeRuns > 0 || p.staleRuns > 0 ||
        new Date(p.latestUpdate).getTime() >= retentionCutoff
      );

      // Sort projects: active runs first, then by latest update
      retainedProjects.sort((a, b) => {
        // Prioritize projects with active runs
        if (a.activeRuns > 0 && b.activeRuns === 0) return -1;
        if (a.activeRuns === 0 && b.activeRuns > 0) return 1;
        // Then sort by latest update
        return b.latestUpdate.localeCompare(a.latestUpdate);
      });

      return NextResponse.json({
        projects: retainedProjects,
        recentCompletionWindowMs: config.recentCompletionWindowMs,
      }, {
        headers: { "Cache-Control": "no-cache, no-store" },
      });
    }

    // Mode: project - return paginated runs for a specific project
    if (project) {
      const config = await getConfig();
      const allRuns = await discoverAllRunDirs();

      // Use cached runs for better performance
      const runs = await Promise.all(
        allRuns
          .filter((r) => r.projectName === project)
          .map(async ({ runDir, source, projectName }) => {
            return await getRunCached(runDir, source, projectName);
          })
      );

      // Apply retention filter: exclude runs older than retentionDays (keep active/stale always)
      const retentionCutoff = Date.now() - config.retentionDays * 24 * 60 * 60 * 1000;
      const retainedRuns = runs.filter((r) => {
        const isActive = r.status === "waiting" || r.status === "pending" || r.isStale;
        if (isActive) return true;
        return new Date(r.updatedAt || "").getTime() >= retentionCutoff;
      });

      // Sort by priority: active non-stale first, stale second, failed third, completed last
      // Within same priority, sort by updatedAt DESC
      retainedRuns.sort((a, b) => {
        const pa = runSortPriority(a);
        const pb = runSortPriority(b);
        if (pa !== pb) return pa - pb;
        return (b.updatedAt || "").localeCompare(a.updatedAt || "");
      });

      let filteredRuns = retainedRuns;

      // Apply status filter if provided
      if (status) {
        filteredRuns = filteredRuns.filter((r) => {
          if (status === "waiting") return r.status === "waiting" || r.status === "pending";
          return r.status === status;
        });
      }

      // Apply search filter if provided
      if (search) {
        const searchLower = search.toLowerCase();
        filteredRuns = filteredRuns.filter(
          (r) =>
            r.runId.toLowerCase().includes(searchLower) ||
            r.processId.toLowerCase().includes(searchLower) ||
            r.status.toLowerCase().includes(searchLower) ||
            r.tasks.some(
              (t) =>
                t.title.toLowerCase().includes(searchLower) ||
                t.label.toLowerCase().includes(searchLower) ||
                (t.error?.message || "").toLowerCase().includes(searchLower) ||
                (t.error?.name || "").toLowerCase().includes(searchLower)
            )
        );
      }

      const totalCount = filteredRuns.length;

      // Apply pagination
      if (limit > 0) {
        filteredRuns = filteredRuns.slice(offset, offset + limit);
      }

      // Strip events from project runs to reduce payload (they're not shown in cards)
      const lightRuns = filteredRuns.map(({ events, ...rest }) => ({
        ...rest,
        events: [],
        totalEvents: events.length,
      }));

      return NextResponse.json(
        {
          runs: lightRuns,
          totalCount,
          project,
        },
        {
          headers: { "Cache-Control": "no-cache, no-store" },
        }
      );
    }

    // Default: return all runs with totalCount
    const allRuns = await discoverAllRunDirs();

    const runs = await Promise.all(
      allRuns.map(async ({ runDir, source, projectName }) => {
        return await getRunCached(runDir, source, projectName);
      })
    );

    // Sort by priority: active non-stale first, stale second, failed third, completed last
    // Within same priority, sort by updatedAt DESC
    runs.sort((a, b) => {
      const pa = runSortPriority(a);
      const pb = runSortPriority(b);
      if (pa !== pb) return pa - pb;
      return (b.updatedAt || "").localeCompare(a.updatedAt || "");
    });

    return NextResponse.json(
      { runs, totalCount: runs.length },
      {
        headers: { "Cache-Control": "no-cache, no-store" },
      }
    );
  } catch (error) {
    console.error("Failed to read runs:", error);
    const normalized = normalizeError(error);
    return NextResponse.json(
      { error: normalized.message, code: normalized.code },
      { status: normalized.status }
    );
  }
}
