import { describe, it, expect, vi, beforeEach } from "vitest";

// Create hoisted mock functions
const { mockAccess, mockWriteFile, mockFindRunDir } = vi.hoisted(() => ({
  mockAccess: vi.fn(),
  mockWriteFile: vi.fn(),
  mockFindRunDir: vi.fn(),
}));

// Mock path-resolver
vi.mock("@/lib/path-resolver", () => ({
  findRunDir: mockFindRunDir,
}));

// Mock fs with a complete replacement that includes default export
vi.mock("fs", () => {
  return {
    default: {
      promises: {
        access: mockAccess,
        writeFile: mockWriteFile,
      },
    },
    promises: {
      access: mockAccess,
      writeFile: mockWriteFile,
    },
  };
});

import { approveBreakpoint } from "../approve-breakpoint";

const defaultSource = { path: "/projects", depth: 2, label: "test" };

describe("approveBreakpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Input validation
  // -------------------------------------------------------------------------

  it("returns error when runId is empty", async () => {
    const result = await approveBreakpoint("", "eff-001", "yes");
    expect(result.success).toBe(false);
    expect(result.error).toContain("Missing or invalid runId");
  });

  it("returns error when effectId is empty", async () => {
    const result = await approveBreakpoint("run-001", "", "yes");
    expect(result.success).toBe(false);
    expect(result.error).toContain("Missing or invalid effectId");
  });

  it("returns error when answer is empty", async () => {
    const result = await approveBreakpoint("run-001", "eff-001", "");
    expect(result.success).toBe(false);
    expect(result.error).toContain("Answer cannot be empty");
  });

  it("returns error when answer is only whitespace", async () => {
    const result = await approveBreakpoint("run-001", "eff-001", "   ");
    expect(result.success).toBe(false);
    expect(result.error).toContain("Answer cannot be empty");
  });

  it("returns error when runId contains path traversal characters", async () => {
    const result = await approveBreakpoint("../etc", "eff-001", "yes");
    expect(result.success).toBe(false);
    expect(result.error).toContain("Invalid characters");
  });

  it("returns error when effectId contains path traversal characters", async () => {
    const result = await approveBreakpoint("run-001", "../../etc", "yes");
    expect(result.success).toBe(false);
    expect(result.error).toContain("Invalid characters");
  });

  // -------------------------------------------------------------------------
  // Run/task resolution
  // -------------------------------------------------------------------------

  it("returns error when run is not found", async () => {
    mockFindRunDir.mockResolvedValue(null);

    const result = await approveBreakpoint("run-999", "eff-001", "yes");
    expect(result.success).toBe(false);
    expect(result.error).toContain("Run not found");
  });

  it("returns error when task directory does not exist", async () => {
    mockFindRunDir.mockResolvedValue({
      runDir: "/projects/app/.a5c/runs/run-001",
      source: defaultSource,
      projectName: "app",
      projectPath: "/projects/app",
    });
    mockAccess.mockRejectedValueOnce(new Error("ENOENT"));

    const result = await approveBreakpoint("run-001", "eff-001", "yes");
    expect(result.success).toBe(false);
    expect(result.error).toContain("Task directory not found");
  });

  // -------------------------------------------------------------------------
  // Success path
  // -------------------------------------------------------------------------

  it("writes result.json directly on success", async () => {
    const runDir = "/projects/app/.a5c/runs/run-001";
    mockFindRunDir.mockResolvedValue({
      runDir,
      source: defaultSource,
      projectName: "app",
      projectPath: "/projects/app",
    });
    mockAccess.mockResolvedValue(undefined);
    mockWriteFile.mockResolvedValue(undefined);

    const result = await approveBreakpoint("run-001", "eff-001", "Deploy approved");
    expect(result.success).toBe(true);

    // Verify result.json was written
    expect(mockWriteFile).toHaveBeenCalledTimes(1);
    const [writePath, content] = mockWriteFile.mock.calls[0];
    expect(writePath).toContain("eff-001");
    expect(writePath).toContain("result.json");

    const parsed = JSON.parse(content as string);
    expect(parsed.status).toBe("ok");
    expect(parsed.value.answer).toBe("Deploy approved");
    expect(parsed.value.approvedBy).toBe("observer-dashboard");
    expect(parsed.value.approvedAt).toBeDefined();
    expect(parsed.startedAt).toBeDefined();
    expect(parsed.finishedAt).toBeDefined();
  });

  it("trims whitespace from the answer", async () => {
    const runDir = "/projects/app/.a5c/runs/run-001";
    mockFindRunDir.mockResolvedValue({
      runDir,
      source: defaultSource,
      projectName: "app",
      projectPath: "/projects/app",
    });
    mockAccess.mockResolvedValue(undefined);
    mockWriteFile.mockResolvedValue(undefined);

    const result = await approveBreakpoint("run-001", "eff-001", "  yes  ");
    expect(result.success).toBe(true);

    const [, content] = mockWriteFile.mock.calls[0];
    const parsed = JSON.parse(content as string);
    expect(parsed.value.answer).toBe("yes");
  });

  // -------------------------------------------------------------------------
  // Write failure
  // -------------------------------------------------------------------------

  it("returns error when file write fails", async () => {
    const runDir = "/projects/app/.a5c/runs/run-001";
    mockFindRunDir.mockResolvedValue({
      runDir,
      source: defaultSource,
      projectName: "app",
      projectPath: "/projects/app",
    });
    mockAccess.mockResolvedValue(undefined);
    mockWriteFile.mockRejectedValue(new Error("EACCES: permission denied"));

    const result = await approveBreakpoint("run-001", "eff-001", "yes");
    expect(result.success).toBe(false);
    expect(result.error).toContain("EACCES");
  });
});
