/**
 * Breakpoint payload resolution — UX-R2 §13.1 (question-shape fix).
 *
 * v6 `ctx.breakpoint` writes the breakpoint's question/title/options/context
 * into `tasks/<effectId>/task.json → metadata.payload.*` (evidence run
 * DEPUTYsmartSAMAL/01KWE8RYQEHJ7BATR3V88AQVSD: payload keys
 * [context, expert, question, tags, title], multi-line question, NO
 * input.json). Older shapes carry the fields in `input.json` or directly under
 * `taskDef.inputs`. This module is the ONE shared resolver used by all three
 * parser extraction sites (task list, task detail, digest batch-read).
 *
 * Precedence per field: input.json > taskDef.inputs > metadata.payload.
 * The first source that carries a field wins; fields resolve INDEPENDENTLY
 * (a title from the payload may accompany a question from inputs).
 *
 * Pure module (no fs) so client components may import the fallback copy.
 */

import type {
  BreakpointPayload,
  BreakpointQuestionSource,
} from "@/types/breakpoint";

/**
 * Honest last-resort question when NO source carries a question (AC-32).
 * Exact copy per SPEC §13.1 — never a bare "Approval required" that implies
 * a generic approval.
 */
export const BREAKPOINT_NO_QUESTION_FALLBACK =
  "Approval required — this breakpoint has no question text on disk.";

/** Parser-resolved payload: questionSource is always present (AC-32 flag). */
export interface ResolvedBreakpointPayload extends BreakpointPayload {
  questionSource: BreakpointQuestionSource;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

/**
 * Resolve a breakpoint's question/title/options/context from the three
 * on-disk sources, in precedence order (UX-R2 §13.1).
 *
 * @param taskDef parsed `tasks/<effectId>/task.json` (or null when missing)
 * @param input   parsed `tasks/<effectId>/input.json` (or undefined when missing)
 */
export function resolveBreakpointPayload(
  taskDef: Record<string, unknown> | null | undefined,
  input?: Record<string, unknown> | null
): ResolvedBreakpointPayload {
  const metadata = asRecord(taskDef?.metadata);
  const sources: Array<{
    source: BreakpointQuestionSource;
    fields: Record<string, unknown> | undefined;
  }> = [
    { source: "input", fields: asRecord(input) },
    { source: "taskDefInputs", fields: asRecord(taskDef?.inputs) },
    { source: "metadataPayload", fields: asRecord(metadata?.payload) },
  ];

  let question: string | undefined;
  let questionSource: BreakpointQuestionSource = "fallback";
  let title: string | undefined;
  let options: string[] | undefined;
  let context: BreakpointPayload["context"];

  for (const { source, fields } of sources) {
    if (!fields) continue;
    if (question === undefined && isNonEmptyString(fields.question)) {
      question = fields.question;
      questionSource = source;
    }
    if (title === undefined && isNonEmptyString(fields.title)) {
      title = fields.title;
    }
    if (options === undefined && Array.isArray(fields.options)) {
      options = fields.options as string[];
    }
    if (context === undefined && fields.context !== undefined) {
      context = fields.context as BreakpointPayload["context"];
    }
  }

  return {
    question: question ?? BREAKPOINT_NO_QUESTION_FALLBACK,
    questionSource,
    // Same title chain as before the fix, extended with the payload source:
    // resolved title, else the task definition's own title, else "Breakpoint".
    title:
      title ??
      (isNonEmptyString(taskDef?.title) ? (taskDef!.title as string) : "Breakpoint"),
    options,
    context,
  };
}
