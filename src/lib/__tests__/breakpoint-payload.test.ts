import { describe, it, expect } from 'vitest';
import {
  resolveBreakpointPayload,
  BREAKPOINT_NO_QUESTION_FALLBACK,
} from '../breakpoint-payload';

/**
 * Unit tests for the shared UX-R2 §13.1 resolver (AC-30..AC-32 substrate).
 * Precedence per field: input.json > taskDef.inputs > metadata.payload —
 * first source that carries the field wins; fields resolve independently.
 */
describe('resolveBreakpointPayload', () => {
  const payloadOnlyTaskDef = {
    kind: 'breakpoint',
    title: 'breakpoint',
    metadata: {
      label: 'breakpoint',
      payload: {
        context: { fresh: { collision: false } },
        expert: 'owner',
        question: 'Payload question?\nSecond line.',
        tags: ['approval-gate'],
        title: 'Gate 1 — payload title',
      },
    },
    inputs: { label: 'breakpoint' },
  };

  it('reads question/title/context from metadata.payload when inputs carry none (v6 shape)', () => {
    const resolved = resolveBreakpointPayload(payloadOnlyTaskDef);

    expect(resolved.question).toBe('Payload question?\nSecond line.');
    expect(resolved.questionSource).toBe('metadataPayload');
    expect(resolved.title).toBe('Gate 1 — payload title');
    expect(resolved.context).toEqual({ fresh: { collision: false } });
  });

  it('gives input.json highest precedence for every field', () => {
    const resolved = resolveBreakpointPayload(
      {
        ...payloadOnlyTaskDef,
        inputs: { question: 'inputs q?', title: 'inputs t', options: ['a'] },
      },
      { question: 'input.json q?', title: 'input.json t', options: ['b'], context: { files: [] } },
    );

    expect(resolved.question).toBe('input.json q?');
    expect(resolved.questionSource).toBe('input');
    expect(resolved.title).toBe('input.json t');
    expect(resolved.options).toEqual(['b']);
    expect(resolved.context).toEqual({ files: [] });
  });

  it('gives taskDef.inputs precedence over metadata.payload', () => {
    const resolved = resolveBreakpointPayload({
      ...payloadOnlyTaskDef,
      inputs: { question: 'inputs q?' },
    });

    expect(resolved.question).toBe('inputs q?');
    expect(resolved.questionSource).toBe('taskDefInputs');
    // title/context still resolve from the payload — fields are independent.
    expect(resolved.title).toBe('Gate 1 — payload title');
    expect(resolved.context).toEqual({ fresh: { collision: false } });
  });

  it('returns the honest last-resort copy, flagged, when no source has a question (AC-32)', () => {
    const resolved = resolveBreakpointPayload({
      kind: 'breakpoint',
      metadata: { label: 'breakpoint' },
      inputs: { label: 'breakpoint' },
    });

    expect(resolved.question).toBe(
      'Approval required — this breakpoint has no question text on disk.',
    );
    expect(resolved.question).toBe(BREAKPOINT_NO_QUESTION_FALLBACK);
    expect(resolved.questionSource).toBe('fallback');
  });

  it('falls back to the task definition title, then "Breakpoint"', () => {
    const withTaskTitle = resolveBreakpointPayload({
      kind: 'breakpoint',
      title: 'Approval Gate',
      inputs: { question: 'q?' },
    });
    expect(withTaskTitle.title).toBe('Approval Gate');

    const bare = resolveBreakpointPayload(null);
    expect(bare.title).toBe('Breakpoint');
    expect(bare.questionSource).toBe('fallback');
  });

  it('ignores non-object sources and empty strings', () => {
    const resolved = resolveBreakpointPayload(
      {
        kind: 'breakpoint',
        inputs: 'not-an-object',
        metadata: { payload: { question: '', title: 'payload title' } },
      },
      null,
    );

    expect(resolved.question).toBe(BREAKPOINT_NO_QUESTION_FALLBACK);
    expect(resolved.questionSource).toBe('fallback');
    expect(resolved.title).toBe('payload title');
  });
});
