import { describe, it, expect, vi, beforeEach } from "vitest";

// Create hoisted mock functions
const { mockExecFileAsync, mockAccess, mockWriteFile, mockFindRunDir } = vi.hoisted(() => ({
  mockExecFileAsync: vi.fn(),
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

// Mock child_process
vi.mock("child_process", () => ({
  default: { execFile: vi.fn() },
  execFile: vi.fn(),
}));

// Mock util
vi.mock("util", () => ({
  default: { promisify: () => mockExecFileAsync },
  promisify: () => mockExecFileAsync,
}));

import { approveBreakpoint } from "../approve-breakpoint";

const defaultSource = { path: "/projects", depth: 2, label: "test" };

describe("approveBreakpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExecFileAsync.mockResolvedValue({ stdout: "", stderr: "" });
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

  it("writes output.json and calls babysitter CLI on success", async () => {
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

    // Verify output.json was written
    expect(mockWriteFile).toHaveBeenCalledTimes(1);
    const [writePath, content] = mockWriteFile.mock.calls[0];
    expect(writePath).toContain("eff-001");
    expect(writePath).toContain("output.json");

    const parsed = JSON.parse(content as string);
    expect(parsed.answer).toBe("Deploy approved");
    expect(parsed.approvedBy).toBe("observer-dashboard");
    expect(parsed.approvedAt).toBeDefined();

    // Verify babysitter CLI was called
    expect(mockExecFileAsync).toHaveBeenCalledTimes(1);
    expect(mockExecFileAsync).toHaveBeenCalledWith(
      "babysitter",
      expect.arrayContaining(["task:post", runDir, "eff-001", "--status", "ok"]),
      expect.objectContaining({ cwd: runDir }),
    );
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
    expect(parsed.answer).toBe("yes");
  });

  // -------------------------------------------------------------------------
  // CLI failure (non-fatal)
  // -------------------------------------------------------------------------

  it("reports CLI failure but still writes output.json", async () => {
    const runDir = "/projects/app/.a5c/runs/run-001";
    mockFindRunDir.mockResolvedValue({
      runDir,
      source: defaultSource,
      projectName: "app",
      projectPath: "/projects/app",
    });
    mockAccess.mockResolvedValue(undefined);
    mockWriteFile.mockResolvedValue(undefined);
    mockExecFileAsync.mockRejectedValue(new Error("babysitter not found"));

    const result = await approveBreakpoint("run-001", "eff-001", "yes");
    expect(result.success).toBe(false);
    expect(result.error).toContain("babysitter CLI failed");
    expect(result.error).toContain("babysitter not found");

    // output.json was still written
    expect(mockWriteFile).toHaveBeenCalledTimes(1);
  });
});
