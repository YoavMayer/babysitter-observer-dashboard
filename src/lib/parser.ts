import { promises as fs } from "fs";
import path from "path";
import type {
  Run,
  RunStatus,
  JournalEvent,
  TaskEffect,
  TaskDetail,
  TaskKind,
  RunDigest,
  EffectRequestedPayload,
  EffectResolvedPayload,
  RunCreatedPayload,
} from "@/types";
import { getConfig } from "@/lib/config";

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readJsonSafe<T>(filePath: string, fallback: T | null | undefined): Promise<T | null | undefined> {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    return JSON.parse(content) as T;
  } catch {
    return fallback;
  }
}

async function readTextSafe(filePath: string): Promise<string | undefined> {
  try {
    return await fs.readFile(filePath, "utf-8");
  } catch {
    return undefined;
  }
}

// Normalize raw journal entry (which uses `data` and `recordedAt`) into our JournalEvent type
function normalizeJournalEvent(raw: Record<string, unknown>, filename: string): JournalEvent | null {
  if (!raw || !raw.type) return null;

  // Parse seq and id from filename: "000001.ULID.json"
  const parts = filename.replace(/\.json$/, "").split(".");
  const seq = parseInt(parts[0], 10) || 0;
  const id = parts[1] || "";

  return {
    seq,
    id,
    ts: (raw.recordedAt as string) || (raw.ts as string) || "",
    type: raw.type as JournalEvent["type"],
    payload: (raw.data as Record<string, unknown>) || (raw.payload as Record<string, unknown>) || {},
  };
}

export async function parseJournalDir(
  journalPath: string
): Promise<JournalEvent[]> {
  if (!(await fileExists(journalPath))) return [];

  const files = await fs.readdir(journalPath);
  const jsonFiles = files.filter((f) => f.endsWith(".json")).sort();

  const events: JournalEvent[] = [];
  for (const file of jsonFiles) {
    const raw = await readJsonSafe<Record<string, unknown>>(
      path.join(journalPath, file),
      null
    );
    if (raw) {
      const event = normalizeJournalEvent(raw, file);
      if (event) events.push(event);
    }
  }

  return events.sort((a, b) => a.seq - b.seq);
}

export async function parseRunDir(runPath: string): Promise<Run> {
  const runJson = await readJsonSafe<Record<string, unknown>>(
    path.join(runPath, "run.json"),
    {}
  );

  const events = await parseJournalDir(path.join(runPath, "journal"));

  // Extract run info from events
  const runCreated = events.find((e) => e.type === "RUN_CREATED");
  const runCompleted = events.find((e) => e.type === "RUN_COMPLETED");
  const runFailed = events.find((e) => e.type === "RUN_FAILED");

  const createdPayload = (runCreated?.payload ||
    {}) as unknown as RunCreatedPayload;

  // Build task map from events
  const taskMap = new Map<string, TaskEffect>();

  for (const event of events) {
    if (event.type === "EFFECT_REQUESTED") {
      const p = event.payload as unknown as EffectRequestedPayload;
      taskMap.set(p.effectId, {
        effectId: p.effectId,
        kind: p.kind,
        title: p.label || p.taskId,
        label: p.label || p.taskId,
        status: "requested",
        invocationKey: p.invocationKey,
        stepId: p.stepId,
        taskId: p.taskId,
        requestedAt: event.ts,
      });

      // Try to read task.json for agent details
      const taskDef = await readJsonSafe<Record<string, unknown>>(
        path.join(runPath, "tasks", p.effectId, "task.json"),
        null
      );
      if (taskDef) {
        const task = taskMap.get(p.effectId)!;
        task.title = (taskDef.title as string) || task.title;
        if (taskDef.agent && typeof taskDef.agent === "object") {
          const agentDef = taskDef.agent as Record<string, unknown>;
          task.agent = {
            name: (agentDef.name as string) || "unknown",
            prompt: agentDef.prompt as NonNullable<TaskEffect["agent"]>["prompt"],
          };
        }
        // Extract breakpoint question from inputs for breakpoint tasks
        if (p.kind === "breakpoint") {
          const inputs = taskDef.inputs as Record<string, unknown> | undefined;
          if (inputs && typeof inputs.question === "string") {
            task.breakpointQuestion = inputs.question;
          }
        }
      }
    }

    if (event.type === "EFFECT_RESOLVED") {
      const p = event.payload as unknown as EffectResolvedPayload;
      const task = taskMap.get(p.effectId);
      if (task) {
        task.status = p.status === "ok" ? "resolved" : "error";
        task.resolvedAt = event.ts;
        task.startedAt = p.startedAt;
        task.finishedAt = p.finishedAt;
        if (p.startedAt && p.finishedAt) {
          task.duration =
            new Date(p.finishedAt).getTime() -
            new Date(p.startedAt).getTime();
        }
        if (p.error) {
          task.error = {
            name: p.error.name,
            message: p.error.message,
            stack: p.error.stack,
          };
        }
      }
    }
  }

  const tasks = Array.from(taskMap.values());
  const completedTasks = tasks.filter((t) => t.status === "resolved").length;
  const failedTasks = tasks.filter((t) => t.status === "error").length;

  // Task 1.2: Extract failed step name from the first task that resolved with error
  const firstFailedTask = tasks.find((t) => t.status === "error");
  const failedStep = firstFailedTask
    ? firstFailedTask.title || firstFailedTask.label || firstFailedTask.stepId
    : undefined;

  // Extract failure details from RUN_FAILED event or last failed EFFECT_RESOLVED
  let failureError: string | undefined;
  let failureMessage: string | undefined;

  if (runFailed) {
    const failPayload = runFailed.payload as Record<string, unknown>;
    const runError = failPayload.error as { name?: string; message?: string; stack?: string } | undefined;
    if (runError) {
      failureError = runError.name || "Error";
      failureMessage = runError.message || runError.stack || undefined;
    }
  }

  // If we still don't have a message, look at the last EFFECT_RESOLVED with error status
  if (!failureMessage) {
    const lastFailedEffect = [...events]
      .reverse()
      .find((e) => e.type === "EFFECT_RESOLVED" && (e.payload as Record<string, unknown>).status === "error");
    if (lastFailedEffect) {
      const effectPayload = lastFailedEffect.payload as Record<string, unknown>;
      const effectError = effectPayload.error as { name?: string; message?: string; stack?: string } | undefined;
      if (effectError) {
        failureError = failureError || effectError.name || "Error";
        failureMessage = effectError.message || effectError.stack || undefined;
      }
    }
  }

  let status: RunStatus = "pending";
  if (runCompleted) status = "completed";
  else if (runFailed) status = "failed";
  else if (tasks.some((t) => t.status === "requested")) status = "waiting";

  // Task 1.3: Extract breakpoint question from pending breakpoint tasks
  let breakpointQuestion: string | undefined;
  if (status === "waiting") {
    const pendingBreakpoint = tasks.find(
      (t) => t.kind === "breakpoint" && t.status === "requested"
    );
    if (pendingBreakpoint?.breakpointQuestion) {
      breakpointQuestion = pendingBreakpoint.breakpointQuestion;
    }
  }

  // Determine waitingKind: check the last requested (pending) task
  let waitingKind: 'breakpoint' | 'task' | undefined;
  if (status === "waiting") {
    const requestedTasks = tasks.filter((t) => t.status === "requested");
    const lastRequested = requestedTasks[requestedTasks.length - 1];
    if (lastRequested) {
      waitingKind = lastRequested.kind === "breakpoint" ? "breakpoint" : "task";
    }
  }

  const createdAt = runCreated?.ts || "";
  const lastEvent = events[events.length - 1];

  let duration: number | undefined;
  if (createdAt && (runCompleted || runFailed)) {
    const endTs = (runCompleted || runFailed)!.ts;
    duration = new Date(endTs).getTime() - new Date(createdAt).getTime();
  } else if (createdAt && lastEvent) {
    duration =
      new Date(lastEvent.ts).getTime() - new Date(createdAt).getTime();
  }

  // Detect staleness for waiting or pending runs
  let isStale: boolean | undefined;
  if (status === "waiting" || status === "pending") {
    const updatedAtTs = lastEvent?.ts || createdAt;
    if (updatedAtTs) {
      const config = await getConfig();
      const timeSinceUpdate = Date.now() - new Date(updatedAtTs).getTime();
      if (timeSinceUpdate > config.staleThresholdMs) {
        isStale = true;
      }
    }
  }

  return {
    runId: createdPayload.runId || path.basename(runPath),
    processId:
      createdPayload.processId ||
      (runJson?.processId as string) ||
      "unknown",
    status,
    createdAt,
    updatedAt: lastEvent?.ts || createdAt,
    completedAt: (runCompleted || runFailed)?.ts,
    tasks,
    events,
    totalTasks: tasks.length,
    completedTasks,
    failedTasks,
    duration,
    failedStep,
    failureError,
    failureMessage,
    breakpointQuestion,
    isStale,
    waitingKind,
  };
}

export async function parseTaskDetail(
  runPath: string,
  effectId: string
): Promise<TaskDetail | null> {
  const taskDir = path.join(runPath, "tasks", effectId);
  if (!(await fileExists(taskDir))) return null;

  const taskDef = await readJsonSafe<Record<string, unknown>>(
    path.join(taskDir, "task.json"),
    null
  );
  const input = await readJsonSafe<Record<string, unknown>>(
    path.join(taskDir, "input.json"),
    undefined
  );
  const result = await readJsonSafe<Record<string, unknown>>(
    path.join(taskDir, "result.json"),
    undefined
  );
  const stdout = await readTextSafe(path.join(taskDir, "stdout.log"));
  const stderr = await readTextSafe(path.join(taskDir, "stderr.log"));

  // Extract timing from result.json
  const resultStartedAt = result?.startedAt as string | undefined;
  const resultFinishedAt = result?.finishedAt as string | undefined;

  // Read journal to get requestedAt and resolvedAt wall-clock timestamps
  const journalEvents = await parseJournalDir(path.join(runPath, "journal"));
  const requestedEvent = journalEvents.find(
    (e) => e.type === "EFFECT_REQUESTED" && (e.payload as Record<string, unknown>).effectId === effectId
  );
  const resolvedEvent = journalEvents.find(
    (e) => e.type === "EFFECT_RESOLVED" && (e.payload as Record<string, unknown>).effectId === effectId
  );

  const requestedAt = requestedEvent?.ts || "";
  const resolvedAt = resolvedEvent?.ts;

  // Compute duration: prefer wall-clock time (requestedAt → resolvedAt) over
  // startedAt/finishedAt which are often identical when set by task:post
  let duration: number | undefined;
  if (resultStartedAt && resultFinishedAt) {
    const resultDuration = new Date(resultFinishedAt).getTime() - new Date(resultStartedAt).getTime();
    // If result timestamps differ, use them; otherwise fall back to journal wall-clock
    if (resultDuration > 0) {
      duration = resultDuration;
    } else if (requestedAt && resolvedAt) {
      duration = new Date(resolvedAt).getTime() - new Date(requestedAt).getTime();
    } else {
      duration = 0;
    }
  } else if (requestedAt && resolvedAt) {
    duration = new Date(resolvedAt).getTime() - new Date(requestedAt).getTime();
  }

  // Use inputs from task.json if separate input.json doesn't exist
  const resolvedInput = input ?? (taskDef?.inputs as Record<string, unknown> | undefined);

  // Extract breakpoint payload for breakpoint tasks
  const kind = (taskDef?.kind as TaskKind) || "agent";
  let breakpointPayload: import("@/types").BreakpointPayload | undefined;
  if (kind === "breakpoint" && resolvedInput) {
    breakpointPayload = {
      question: (resolvedInput.question as string) || "Approval required",
      title: (resolvedInput.title as string) || (taskDef?.title as string) || "Breakpoint",
      context: resolvedInput.context as import("@/types").BreakpointPayload["context"],
    };
  }

  // Determine error status from result or journal
  const resolvedPayload = resolvedEvent?.payload as Record<string, unknown> | undefined;
  const isError = result
    ? (result.status === "error")
    : (resolvedPayload?.status === "error");

  return {
    effectId,
    kind,
    title: (taskDef?.title as string) || effectId,
    label: (taskDef?.title as string) || effectId,
    status: resolvedEvent ? (isError ? "error" : "resolved") : "requested",
    invocationKey: (taskDef?.invocationKey as string) || "",
    stepId: (taskDef?.stepId as string) || "",
    taskId: (taskDef?.taskId as string) || "",
    requestedAt,
    resolvedAt,
    startedAt: resultStartedAt,
    finishedAt: resultFinishedAt,
    duration,
    input: resolvedInput,
    result: result ?? undefined,
    stdout,
    stderr,
    taskDef: taskDef ?? undefined,
    breakpoint: breakpointPayload,
    breakpointQuestion: breakpointPayload?.question,
  };
}

export async function getRunDigest(runPath: string): Promise<RunDigest> {
  const journalPath = path.join(runPath, "journal");
  let latestSeq = 0;
  let status: RunStatus = "pending";
  let taskCount = 0;
  let completedTasks = 0;
  let updatedAt = "";

  const requestedBreakpoints = new Set<string>();
  const resolvedEffects = new Set<string>();
  const breakpointEffectIds = new Set<string>();
  // Track requested effects and their kinds for waitingKind determination
  const requestedEffects: Array<{ effectId: string; kind: string }> = [];

  if (await fileExists(journalPath)) {
    const files = await fs.readdir(journalPath);
    const jsonFiles = files.filter((f) => f.endsWith(".json")).sort();
    latestSeq = jsonFiles.length;

    // Read all events for accurate counts
    for (const file of jsonFiles) {
      const raw = await readJsonSafe<Record<string, unknown>>(
        path.join(journalPath, file),
        null
      );
      if (!raw) continue;
      const event = normalizeJournalEvent(raw, file);
      if (!event) continue;
      updatedAt = event.ts;
      if (event.type === "EFFECT_REQUESTED") {
        taskCount++;
        const data = event.payload as Record<string, unknown>;
        const effectId = data.effectId as string;
        const kind = (data.kind as string) || "agent";
        requestedEffects.push({ effectId, kind });
        if (data.kind === "breakpoint") {
          requestedBreakpoints.add(effectId);
          breakpointEffectIds.add(effectId);
        }
      }
      if (event.type === "EFFECT_RESOLVED") {
        completedTasks++;
        const data = event.payload as Record<string, unknown>;
        resolvedEffects.add(data.effectId as string);
      }
      if (event.type === "RUN_COMPLETED") status = "completed";
      if (event.type === "RUN_FAILED") status = "failed";
    }

    if (status === "pending" && taskCount > 0) status = "waiting";
  }

  // Count pending breakpoints (requested but not yet resolved)
  let pendingBreakpoints = 0;
  for (const bpId of requestedBreakpoints) {
    if (!resolvedEffects.has(bpId)) pendingBreakpoints++;
  }

  // Extract breakpoint question from pending breakpoint task
  let breakpointQuestion: string | undefined;
  if (status === "waiting" && breakpointEffectIds.size > 0) {
    for (const effectId of breakpointEffectIds) {
      if (!resolvedEffects.has(effectId)) {
        // This is a pending breakpoint, try to read its question
        const taskDef = await readJsonSafe<Record<string, unknown>>(
          path.join(runPath, "tasks", effectId, "task.json"),
          null
        );
        if (taskDef) {
          const inputs = taskDef.inputs as Record<string, unknown> | undefined;
          if (inputs && typeof inputs.question === "string") {
            breakpointQuestion = inputs.question;
            break; // Use the first pending breakpoint question found
          }
        }
      }
    }
  }

  // Determine waitingKind from the last requested (pending) effect
  let waitingKind: 'breakpoint' | 'task' | undefined;
  if (status === "waiting") {
    // Find the last requested effect that hasn't been resolved
    const pendingEffects = requestedEffects.filter(
      (e) => !resolvedEffects.has(e.effectId)
    );
    const lastPending = pendingEffects[pendingEffects.length - 1];
    if (lastPending) {
      waitingKind = lastPending.kind === "breakpoint" ? "breakpoint" : "task";
    }
  }

  // Detect staleness for waiting or pending runs
  let isStale: boolean | undefined;
  if (status === "waiting" || status === "pending") {
    if (updatedAt) {
      const config = await getConfig();
      const timeSinceUpdate = Date.now() - new Date(updatedAt).getTime();
      if (timeSinceUpdate > config.staleThresholdMs) {
        isStale = true;
      }
    }
  }

  return {
    runId: path.basename(runPath),
    latestSeq,
    status,
    taskCount,
    completedTasks,
    updatedAt,
    pendingBreakpoints,
    breakpointQuestion,
    isStale,
    waitingKind,
  };
}

export async function getRunIds(runsPath: string): Promise<string[]> {
  if (!(await fileExists(runsPath))) return [];
  const entries = await fs.readdir(runsPath, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort()
    .reverse();
}
