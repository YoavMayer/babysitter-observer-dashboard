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

/**
 * UX-R3 wave 3 (in-progress indication) — layer journal-activity freshness on
 * top of the lock verdict so genuinely-active runs are detected even when no
 * `run.lock` exists.
 *
 * WHY THIS EXISTS (disk-confirmed, 2026-07-06): across 308 real run dirs in all
 * watched sources, ZERO carry a `run.lock` — babysitter 6.0.2 in this
 * environment never writes one. `getDriverLiveness` therefore always returns
 * "none" for in-progress runs, so `assignColumn` classifies every non-terminal
 * run as Orphaned and the WORKING column is STRUCTURALLY always 0, even while
 * driver sessions are actively iterating. The only on-disk signal that reliably
 * distinguishes a run being actively worked from an abandoned one — and that is
 * present without any lock — is the freshness of its newest JOURNAL entry
 * (each orchestration step appends EFFECT_REQUESTED / EFFECT_RESOLVED, bumping
 * `updatedAt`). Session markers (`~/.a5c/state/<uuid>.md` `active:true`) exist
 * for some sessions but are NOT universal (a claude-code orchestrator run has
 * none), live outside the watched run sources, and can go stale — so journal
 * freshness is the honest primary signal; the lock stays as one possible input.
 *
 * HONESTY CONTRACT: a run is promoted to "live" ONLY when it has REAL evidence
 * of recent work — its newest journal event is within `freshnessMs`. A stale
 * non-terminal run keeps the lock verdict (no lock → "none" → still reads as
 * Stalled/Orphaned), so this never paints a merely-non-terminal run as Working.
 *
 * `freshnessMs` is the SAME window as staleness (OBSERVER_STALE_THRESHOLD_MS /
 * registry `staleThresholdMs`, default 1h): a run is "actively progressing"
 * exactly while it has not yet gone stale. Callers pass `config.staleThresholdMs`
 * so the freshness window is a single, documented, env-overridable constant and
 * there is no daylight between "live" and "!isStale".
 *
 * Pure and deterministic (`now` injectable) for unit testing.
 */
export function deriveLivenessFromActivity(
  lockLiveness: DriverLiveness,
  updatedAt: string | undefined,
  freshnessMs: number,
  now: number = Date.now()
): DriverLiveness {
  // A live lock is definitive — never downgraded by activity age.
  if (lockLiveness === "live") return "live";
  // No live lock: recent journal activity means the run is actively progressing.
  if (updatedAt && freshnessMs > 0) {
    const age = now - new Date(updatedAt).getTime();
    if (Number.isFinite(age) && age >= 0 && age <= freshnessMs) return "live";
  }
  // Otherwise the lock verdict stands: dead lock → "orphaned"; no lock → "none".
  return lockLiveness;
}
