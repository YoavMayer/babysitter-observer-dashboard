import { promises as fs } from "fs";
import path from "path";

/**
 * Orchestrator-attachment (liveness) of a run, derived read-only from its
 * `run.lock` file and OS process liveness. This is the signal the observer
 * lacked: a run can be idle because a live orchestrator is between steps, or
 * because its driver died. The journal alone can't tell them apart.
 *
 *  - "live"     — a run.lock exists and its pid is a running process.
 *  - "orphaned" — a run.lock exists but its pid is dead (driver crashed / gone).
 *  - "none"     — no run.lock (no orchestrator is, or recently was, attached).
 */
export type DriverLiveness = "live" | "orphaned" | "none";

interface RunLock {
  pid?: number;
  owner?: string;
  acquiredAt?: string;
}

/** True if `pid` refers to a live process. `kill(pid, 0)` never actually signals. */
function isPidAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    // EPERM => the process exists but is owned by another user → still "alive".
    return (err as NodeJS.ErrnoException)?.code === "EPERM";
  }
}

/**
 * Read `<runDir>/run.lock` and classify the run's driver liveness. Pure read;
 * never throws (returns "none" on any missing/corrupt lock).
 */
export async function getDriverLiveness(runDir: string): Promise<DriverLiveness> {
  try {
    const raw = await fs.readFile(path.join(runDir, "run.lock"), "utf-8");
    const lock = JSON.parse(raw) as RunLock;
    if (typeof lock.pid !== "number") return "orphaned";
    return isPidAlive(lock.pid) ? "live" : "orphaned";
  } catch {
    return "none";
  }
}
