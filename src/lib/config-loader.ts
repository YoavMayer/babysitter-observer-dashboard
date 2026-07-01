import { promises as fs } from "fs";
import path from "path";
import os from "os";

/** Return true when err represents a "file/directory not found" filesystem error. */
export function isNotFoundError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const code = (err as NodeJS.ErrnoException).code;
  return code === "ENOENT" || code === "ENOTDIR" || err.message.includes("ENOENT");
}

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
  recentCompletionWindowMs: number;
  retentionDays: number;
  hiddenProjects: string[];
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
  recentCompletionWindowMs?: number;
  retentionDays?: number;
  hiddenProjects?: string[];
}): Promise<void> {
  const dir = path.dirname(REGISTRY_PATH);
  await fs.mkdir(dir, { recursive: true });

  // Read existing file to preserve any extra fields
  let existing: Record<string, unknown> = {};
  try {
    const content = await fs.readFile(REGISTRY_PATH, "utf-8");
    existing = JSON.parse(content);
  } catch (err) {
    // Expected when writing config for the first time; warn if the file exists but is unreadable
    if (!isNotFoundError(err)) {
      console.warn(`[config] Failed to read existing config at ${REGISTRY_PATH} before merge:`, err);
    }
  }

  const merged = {
    ...existing,
    sources: data.sources,
    ...(data.pollInterval !== undefined ? { pollInterval: data.pollInterval } : {}),
    ...(data.theme !== undefined ? { theme: data.theme } : {}),
    ...(data.staleThresholdMs !== undefined ? { staleThresholdMs: data.staleThresholdMs } : {}),
    ...(data.recentCompletionWindowMs !== undefined ? { recentCompletionWindowMs: data.recentCompletionWindowMs } : {}),
    ...(data.retentionDays !== undefined ? { retentionDays: data.retentionDays } : {}),
    ...(data.hiddenProjects !== undefined ? { hiddenProjects: data.hiddenProjects } : {}),
  };

  await fs.writeFile(REGISTRY_PATH, JSON.stringify(merged, null, 2) + "\n", "utf-8");
}

interface RegistryData {
  sources: WatchSource[];
  pollInterval?: number;
  theme?: "dark" | "light";
  staleThresholdMs?: number;
  recentCompletionWindowMs?: number;
  retentionDays?: number;
  hiddenProjects?: string[];
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
      recentCompletionWindowMs: typeof parsed.recentCompletionWindowMs === "number" ? parsed.recentCompletionWindowMs : undefined,
      retentionDays: typeof parsed.retentionDays === "number" ? parsed.retentionDays : undefined,
      hiddenProjects: Array.isArray(parsed.hiddenProjects) ? parsed.hiddenProjects.filter((s: unknown) => typeof s === "string") : undefined,
    };
  } catch (err) {
    if (!isNotFoundError(err)) {
      console.warn(`[config] Failed to load registry from ${REGISTRY_PATH} — using defaults:`, err);
    }
    return { sources: [] };
  }
}

// Explicit watch-dir sources requested at invocation time: the CLI flag
// (OBSERVER_WATCH_DIR, set by src/cli.ts) or the WATCH_DIR / WATCH_DIRS envs.
// These express explicit user intent and take precedence over the persisted registry.
function getExplicitEnvSources(): WatchSource[] {
  const sources: WatchSource[] = [];

  // CLI flag via OBSERVER_WATCH_DIR (set by src/cli.ts --watch-dir)
  if (process.env.OBSERVER_WATCH_DIR) {
    sources.push({ path: process.env.OBSERVER_WATCH_DIR, depth: 3, label: "cli" });
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

  return sources;
}

// Last-resort fallback when neither an explicit flag/env nor the registry
// supplies sources: parent of cwd (observe sibling projects).
function getFallbackSources(): WatchSource[] {
  return [{ path: path.resolve(process.cwd(), ".."), depth: 3, label: "parent" }];
}

export async function getConfig(): Promise<ObserverConfig> {
  const now = Date.now();
  if (cachedConfig && now - cacheTime < CACHE_TTL) {
    return cachedConfig;
  }

  const registry = await loadRegistry();
  const explicitEnvSources = getExplicitEnvSources();

  // Precedence: an explicit --watch-dir / WATCH_DIR(S) at invocation time wins over
  // the persisted registry, which in turn wins over the parent-of-cwd fallback.
  // (Previously a non-empty registry silently overrode an explicit --watch-dir.)
  // Deduplicate sources by normalized path to prevent duplicate discovery.
  const chosen =
    explicitEnvSources.length > 0
      ? explicitEnvSources
      : registry.sources.length > 0
        ? registry.sources
        : getFallbackSources();

  // Always also watch the agent-default runs dir (~/.a5c/runs). Runs are created
  // in EITHER ~/.a5c/runs (agent default) OR <project>/.a5c/runs; watching only
  // one hid the user's current work. depth:0 => treat it as a direct runs dir.
  const rawSources: WatchSource[] = [
    ...chosen,
    { path: path.join(os.homedir(), ".a5c", "runs"), depth: 0, label: "home" },
  ];
  const seen = new Set<string>();
  const sources = rawSources.filter((s) => {
    const normalized = path.resolve(s.path);
    if (seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });

  // Priority: registry file > env vars > defaults
  const envPollInterval = process.env.OBSERVER_POLL_INTERVAL || process.env.POLL_INTERVAL;
  const envTheme = process.env.OBSERVER_DEFAULT_THEME || process.env.THEME;
  const envStaleThreshold = process.env.OBSERVER_STALE_THRESHOLD_MS;
  const envRecentWindow = process.env.OBSERVER_RECENT_WINDOW_MS;
  const envRetentionDays = process.env.OBSERVER_RETENTION_DAYS;

  cachedConfig = {
    sources,
    port: parseInt(process.env.OBSERVER_PORT || process.env.PORT || "4800", 10),
    pollInterval: registry.pollInterval ?? (envPollInterval ? parseInt(envPollInterval, 10) : 2000),
    theme: registry.theme ?? ((envTheme === "dark" || envTheme === "light" ? envTheme : "dark") as "dark" | "light"),
    staleThresholdMs: registry.staleThresholdMs ?? (envStaleThreshold ? parseInt(envStaleThreshold, 10) : 3600000),
    recentCompletionWindowMs: registry.recentCompletionWindowMs ?? (envRecentWindow ? parseInt(envRecentWindow, 10) : 14400000),
    retentionDays: registry.retentionDays ?? (envRetentionDays ? parseInt(envRetentionDays, 10) : 30),
    hiddenProjects: registry.hiddenProjects ?? [],
  };
  cacheTime = now;

  return cachedConfig;
}
