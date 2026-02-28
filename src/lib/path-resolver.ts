import path from "path";
import { discoverAllRunDirs, type DiscoveredRun } from "./source-discovery";

// Find a specific run directory by runId across all sources
export async function findRunDir(runId: string): Promise<DiscoveredRun | null> {
  const allRuns = await discoverAllRunDirs();
  return allRuns.find((r) => path.basename(r.runDir) === runId) || null;
}
