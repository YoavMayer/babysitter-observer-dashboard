import { promises as fs } from "fs";
import path from "path";
import os from "os";

export interface WatchSource {
  path: string;
  depth: number; // how many levels deep to search for .a5c/runs/
  label?: string;
}

export interface ObserverConfig {
  sources: WatchSource[];
  port: number;
  pollInterval: number;
  theme: "dark" | "light";
  staleThresholdMs: number;
}

// Default registry path
const REGISTRY_PATH =
  process.env.OBSERVER_REGISTRY ||
  path.join(os.homedir(), ".a5c", "observer.json");

let cachedConfig: ObserverConfig | null = null;
let cacheTime = 0;
const CACHE_TTL = 10000; // 10s

// Invalidate the config cache (called after POST /api/config writes new values)
export function invalidateConfigCache(): void {
  cachedConfig = null;
  cacheTime = 0;
}

// Write config to the registry file (~/.a5c/observer.json)
export async function writeConfig(data: {
  sources: WatchSource[];
  pollInterval?: number;
  theme?: string;
  staleThresholdMs?: number;
}): Promise<void> {
  const dir = path.dirname(REGISTRY_PATH);
  await fs.mkdir(dir, { recursive: true });

  // Read existing file to preserve any extra fields
  let existing: Record<string, unknown> = {};
  try {
    const content = await fs.readFile(REGISTRY_PATH, "utf-8");
    existing = JSON.parse(content);
  } catch {
    // File doesn't exist yet
  }

  const merged = {
    ...existing,
    sources: data.sources,
    ...(data.pollInterval !== undefined ? { pollInterval: data.pollInterval } : {}),
    ...(data.theme !== undefined ? { theme: data.theme } : {}),
    ...(data.staleThresholdMs !== undefined ? { staleThresholdMs: data.staleThresholdMs } : {}),
  };

  await fs.writeFile(REGISTRY_PATH, JSON.stringify(merged, null, 2) + "\n", "utf-8");
}

interface RegistryData {
  sources: WatchSource[];
  pollInterval?: number;
  theme?: "dark" | "light";
  staleThresholdMs?: number;
}

async function loadRegistry(): Promise<RegistryData> {
  try {
    const content = await fs.readFile(REGISTRY_PATH, "utf-8");
    const parsed = JSON.parse(content);
    const sources = Array.isArray(parsed.sources)
      ? parsed.sources.map((s: Record<string, unknown>) => ({
          path: String(s.path || ""),
          depth: typeof s.depth === "number" ? s.depth : 2,
          label: s.label ? String(s.label) : undefined,
        }))
      : [];
    return {
      sources,
      pollInterval: typeof parsed.pollInterval === "number" ? parsed.pollInterval : undefined,
      theme: parsed.theme === "dark" || parsed.theme === "light" ? parsed.theme : undefined,
      staleThresholdMs: typeof parsed.staleThresholdMs === "number" ? parsed.staleThresholdMs : undefined,
    };
  } catch {
    return { sources: [] };
  }
}

function getDefaultSources(): WatchSource[] {
  const sources: WatchSource[] = [];

  // CLI flag via OBSERVER_WATCH_DIR (set by src/cli.ts)
  if (process.env.OBSERVER_WATCH_DIR) {
    sources.push({ path: process.env.OBSERVER_WATCH_DIR, depth: 2, label: "cli" });
  }

  // WATCH_DIR env (backwards-compatible single dir)
  if (process.env.WATCH_DIR) {
    sources.push({ path: process.env.WATCH_DIR, depth: 0, label: "env" });
  }

  // WATCH_DIRS env (comma-separated)
  if (process.env.WATCH_DIRS) {
    for (const dir of process.env.WATCH_DIRS.split(",")) {
      const trimmed = dir.trim();
      if (trimmed) sources.push({ path: trimmed, depth: 2 });
    }
  }

  // cwd fallback
  if (sources.length === 0) {
    sources.push({
      path: process.cwd(),
      depth: 2,
      label: "cwd",
    });
  }

  return sources;
}

export async function getConfig(): Promise<ObserverConfig> {
  const now = Date.now();
  if (cachedConfig && now - cacheTime < CACHE_TTL) {
    return cachedConfig;
  }

  const registry = await loadRegistry();
  const defaultSources = getDefaultSources();

  // Merge: registry sources take priority, defaults as fallback
  const sources = registry.sources.length > 0 ? registry.sources : defaultSources;

  // Priority: registry file > env vars > defaults
  const envPollInterval = process.env.OBSERVER_POLL_INTERVAL || process.env.POLL_INTERVAL;
  const envTheme = process.env.OBSERVER_DEFAULT_THEME || process.env.THEME;
  const envStaleThreshold = process.env.OBSERVER_STALE_THRESHOLD_MS;

  cachedConfig = {
    sources,
    port: parseInt(process.env.OBSERVER_PORT || process.env.PORT || "3000", 10),
    pollInterval: registry.pollInterval ?? (envPollInterval ? parseInt(envPollInterval, 10) : 2000),
    theme: registry.theme ?? ((envTheme === "dark" || envTheme === "light" ? envTheme : "dark") as "dark" | "light"),
    staleThresholdMs: registry.staleThresholdMs ?? (envStaleThreshold ? parseInt(envStaleThreshold, 10) : 3600000),
  };
  cacheTime = now;

  return cachedConfig;
}

// Discover all .a5c/runs/ directories within a source
async function discoverRunsInSource(source: WatchSource): Promise<string[]> {
  const results: string[] = [];

  async function scan(dir: string, currentDepth: number) {
    try {
      // Check if this directory itself IS an .a5c/runs dir (depth=0 means direct path)
      if (source.depth === 0) {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        return entries
          .filter((e) => e.isDirectory())
          .map((e) => path.join(dir, e.name));
      }

      // Check for .a5c/runs/ at this level
      const runsPath = path.join(dir, ".a5c", "runs");
      try {
        const stat = await fs.stat(runsPath);
        if (stat.isDirectory()) {
          results.push(runsPath);
        }
      } catch {
        // No .a5c/runs here
      }

      // Recurse into subdirectories if within depth
      if (currentDepth < source.depth) {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (
            entry.isDirectory() &&
            !entry.name.startsWith(".") &&
            entry.name !== "node_modules"
          ) {
            await scan(path.join(dir, entry.name), currentDepth + 1);
          }
        }
      }
    } catch {
      // Permission denied or not found
    }
  }

  if (source.depth === 0) {
    // Direct .a5c/runs path — just return runs inside it
    try {
      const entries = await fs.readdir(source.path, { withFileTypes: true });
      return entries
        .filter((e) => e.isDirectory())
        .map((e) => path.join(source.path, e.name));
    } catch {
      return [];
    }
  }

  await scan(source.path, 0);
  return results;
}

export interface DiscoveredRun {
  runDir: string;
  source: WatchSource;
  projectName: string; // e.g. "hockey_7_shifts", "podcast-intel"
  projectPath: string; // full path to the project directory
}

// Extract project name from a .a5c/runs/ path
function extractProjectName(runsDir: string): { projectName: string; projectPath: string } {
  // runsDir is like /path/to/project/.a5c/runs
  // projectPath is /path/to/project
  const a5cDir = path.dirname(runsDir); // .a5c
  const projectPath = path.dirname(a5cDir); // project dir
  const projectName = path.basename(projectPath);
  return { projectName, projectPath };
}

// Get all run directories across all sources
export async function discoverAllRunDirs(): Promise<DiscoveredRun[]> {
  const config = await getConfig();
  const allRuns: DiscoveredRun[] = [];

  for (const source of config.sources) {
    if (source.depth === 0) {
      // Direct runs directory — list subdirs as individual runs
      // Project name: prefer run.json's projectName, fall back to source label or path
      const fallbackProjectName = source.label || path.basename(source.path);
      try {
        const entries = await fs.readdir(source.path, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory()) {
            // Try to read projectName from run.json for more accurate project grouping
            let projectName = fallbackProjectName;
            try {
              const runJsonPath = path.join(source.path, entry.name, "run.json");
              const content = await fs.readFile(runJsonPath, "utf-8");
              const json = JSON.parse(content);
              if (json.projectName) {
                projectName = json.projectName;
              }
            } catch {
              // run.json doesn't exist or is malformed — use fallback
            }
            allRuns.push({
              runDir: path.join(source.path, entry.name),
              source,
              projectName,
              projectPath: source.path,
            });
          }
        }
      } catch {
        // Source not accessible
      }
    } else {
      // Discover .a5c/runs/ directories within depth
      const runsDirs = await discoverRunsInSource(source);
      for (const runsDir of runsDirs) {
        const { projectName, projectPath } = extractProjectName(runsDir);
        try {
          const entries = await fs.readdir(runsDir, { withFileTypes: true });
          for (const entry of entries) {
            if (entry.isDirectory()) {
              allRuns.push({
                runDir: path.join(runsDir, entry.name),
                source,
                projectName,
                projectPath,
              });
            }
          }
        } catch {
          // Can't read this runs dir
        }
      }
    }
  }

  return allRuns;
}

// Find a specific run directory by runId across all sources
export async function findRunDir(runId: string): Promise<DiscoveredRun | null> {
  const allRuns = await discoverAllRunDirs();
  return allRuns.find((r) => path.basename(r.runDir) === runId) || null;
}
