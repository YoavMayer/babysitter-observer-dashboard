import { getRunDigest, parseRunDir } from "./parser";
import { discoverAllRunDirs, type WatchSource, type DiscoveredRun } from "./config";
import type { RunDigest, Run, ProjectSummary } from "@/types";
import { promises as fs } from "fs";
import path from "path";

// Extended RunDigest with cache metadata
export interface CachedRunDigest extends RunDigest {
  processId: string;
  sourceLabel?: string;
  projectName?: string;
}

interface CacheEntry {
  digest: CachedRunDigest;
  cachedAt: number;
  runDir: string;
  fullRun?: Run;
}

// Persist cache across HMR reloads via globalThis
const CACHE_KEY = '__observer_run_cache__';

function getCache(): Map<string, CacheEntry> {
  if (!(globalThis as any)[CACHE_KEY]) {
    (globalThis as any)[CACHE_KEY] = new Map<string, CacheEntry>();
  }
  return (globalThis as any)[CACHE_KEY];
}

// Cache size limit to prevent unbounded memory growth
const MAX_CACHE_SIZE = 1000;

// TTL constants
const TTL_COMPLETED = 30000; // 30s for completed runs
const TTL_ACTIVE = 5000; // 5s for active runs (waiting/pending)

function getTTL(status: RunDigest["status"]): number {
  return status === "waiting" || status === "pending" ? TTL_ACTIVE : TTL_COMPLETED;
}

function isCacheValid(entry: CacheEntry): boolean {
  const now = Date.now();
  const ttl = getTTL(entry.digest.status);
  return now - entry.cachedAt < ttl;
}

// Evict oldest entries when cache exceeds MAX_CACHE_SIZE.
// Evicts expired entries first, then oldest by cachedAt if still over limit.
function evictIfNeeded(): void {
  const cache = getCache();
  if (cache.size <= MAX_CACHE_SIZE) return;

  // First pass: remove expired entries
  const now = Date.now();
  for (const [key, entry] of cache) {
    if (now - entry.cachedAt >= getTTL(entry.digest.status)) {
      cache.delete(key);
    }
  }
  if (cache.size <= MAX_CACHE_SIZE) return;

  // Second pass: evict oldest entries until under limit
  const entries = Array.from(cache.entries()).sort(
    ([, a], [, b]) => a.cachedAt - b.cachedAt
  );
  const toRemove = cache.size - MAX_CACHE_SIZE;
  for (let i = 0; i < toRemove; i++) {
    cache.delete(entries[i][0]);
  }
}

// Read processId and optional projectName from run.json
async function getRunJsonMeta(runDir: string): Promise<{ processId: string; projectName?: string }> {
  try {
    const runJsonPath = path.join(runDir, "run.json");
    const content = await fs.readFile(runJsonPath, "utf-8");
    const json = JSON.parse(content);
    return {
      processId: json.processId || "unknown",
      projectName: json.projectName || undefined,
    };
  } catch {
    return { processId: "unknown" };
  }
}

export async function getDigestCached(
  runDir: string,
  source: WatchSource,
  projectName: string
): Promise<CachedRunDigest> {
  const cache = getCache();
  const entry = cache.get(runDir);

  // Return cached if valid
  if (entry && isCacheValid(entry)) {
    return entry.digest;
  }

  // Cache miss — fetch fresh digest
  const digest = await getRunDigest(runDir);
  const meta = await getRunJsonMeta(runDir);

  // Prefer projectName from run.json over discovery-provided name
  const effectiveProjectName = meta.projectName || projectName;

  const cachedDigest: CachedRunDigest = {
    ...digest,
    processId: meta.processId,
    sourceLabel: source.label,
    projectName: effectiveProjectName,
  };

  // Update cache
  cache.set(runDir, {
    digest: cachedDigest,
    cachedAt: Date.now(),
    runDir,
    fullRun: entry?.fullRun, // Preserve full run if present
  });

  evictIfNeeded();

  return cachedDigest;
}

export async function getRunCached(
  runDir: string,
  source: WatchSource,
  projectName: string
): Promise<Run> {
  const cache = getCache();
  const entry = cache.get(runDir);

  // Return cached full run if valid and present
  if (entry && isCacheValid(entry) && entry.fullRun) {
    return entry.fullRun;
  }

  // Fetch full run
  const run = await parseRunDir(runDir);

  // Read run.json meta for accurate projectName
  const meta = await getRunJsonMeta(runDir);
  const effectiveProjectName = meta.projectName || projectName;

  // Enrich with metadata
  const enrichedRun: Run = {
    ...run,
    sourceLabel: source.label,
    projectName: effectiveProjectName,
  };

  // Update cache with full run
  const digest = await getDigestCached(runDir, source, projectName);
  cache.set(runDir, {
    digest,
    cachedAt: Date.now(),
    runDir,
    fullRun: enrichedRun,
  });

  evictIfNeeded();

  return enrichedRun;
}

export function invalidateRun(runDir: string): void {
  getCache().delete(runDir);
}

export function invalidateAll(): void {
  getCache().clear();
}

export function getProjectSummaries(): ProjectSummary[] {
  const cache = getCache();
  const projectMap = new Map<string, {
    totalRuns: number;
    activeRuns: number;
    completedRuns: number;
    failedRuns: number;
    staleRuns: number;
    totalTasks: number;
    completedTasksAggregate: number;
    latestUpdate: string;
  }>();

  for (const entry of cache.values()) {
    const projectName = entry.digest.projectName || "Unknown";
    const existing = projectMap.get(projectName) || {
      totalRuns: 0,
      activeRuns: 0,
      completedRuns: 0,
      failedRuns: 0,
      staleRuns: 0,
      totalTasks: 0,
      completedTasksAggregate: 0,
      latestUpdate: "",
    };

    existing.totalRuns++;
    existing.totalTasks += entry.digest.taskCount || 0;
    existing.completedTasksAggregate += entry.digest.completedTasks || 0;

    if ((entry.digest.status === "waiting" || entry.digest.status === "pending") && !entry.digest.isStale) {
      existing.activeRuns++;
    } else if (entry.digest.status === "completed") {
      existing.completedRuns++;
    } else if (entry.digest.status === "failed") {
      existing.failedRuns++;
    }

    if (entry.digest.isStale) {
      existing.staleRuns++;
    }

    // Track latest update
    if (!existing.latestUpdate || entry.digest.updatedAt > existing.latestUpdate) {
      existing.latestUpdate = entry.digest.updatedAt;
    }

    projectMap.set(projectName, existing);
  }

  return Array.from(projectMap.entries()).map(([projectName, stats]) => ({
    projectName,
    ...stats,
  }));
}

export async function discoverAndCacheAll(): Promise<void> {
  const discovered = await discoverAllRunDirs();

  // Deduplicate by normalized runDir path - keep the first occurrence (most specific source)
  const seen = new Set<string>();
  const unique = discovered.filter((d: DiscoveredRun) => {
    const normalized = path.resolve(d.runDir);
    if (seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });

  // Pre-populate cache with digests
  await Promise.all(
    unique.map(async (discoveredRun: DiscoveredRun) => {
      try {
        await getDigestCached(
          discoveredRun.runDir,
          discoveredRun.source,
          discoveredRun.projectName
        );
      } catch (err) {
        console.error(`Failed to cache run ${discoveredRun.runDir}:`, err);
      }
    })
  );
}

// Export cache for debugging
export function getCacheStats() {
  const cache = getCache();
  return {
    size: cache.size,
    entries: Array.from(cache.entries()).map(([runDir, entry]) => ({
      runDir,
      status: entry.digest.status,
      cachedAt: entry.cachedAt,
      hasFullRun: !!entry.fullRun,
    })),
  };
}
