import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { getDriverLiveness } from "../liveness";

describe("getDriverLiveness", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "liveness-"));
  });
  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  const writeLock = (obj: unknown) =>
    fs.writeFile(path.join(dir, "run.lock"), JSON.stringify(obj), "utf-8");

  it("returns 'none' when there is no run.lock", async () => {
    expect(await getDriverLiveness(dir)).toBe("none");
  });

  it("returns 'live' when the lock pid is a running process", async () => {
    await writeLock({ pid: process.pid, owner: "test" });
    expect(await getDriverLiveness(dir)).toBe("live");
  });

  it("returns 'orphaned' when the lock pid is dead", async () => {
    // 2^31-1 is a valid-looking pid that will not be running.
    await writeLock({ pid: 2147483646, owner: "test" });
    expect(await getDriverLiveness(dir)).toBe("orphaned");
  });

  it("returns 'orphaned' when the lock has no pid", async () => {
    await writeLock({ owner: "test" });
    expect(await getDriverLiveness(dir)).toBe("orphaned");
  });

  it("returns 'none' on a corrupt lock file", async () => {
    await fs.writeFile(path.join(dir, "run.lock"), "not-json{", "utf-8");
    expect(await getDriverLiveness(dir)).toBe("none");
  });
});
