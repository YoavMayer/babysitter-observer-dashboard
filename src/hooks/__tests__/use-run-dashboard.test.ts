import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useRunDashboard } from '../use-run-dashboard';
import { createMockProjectSummary } from '@/test/fixtures';

// Mock useProjects
const mockRefresh = vi.fn();
vi.mock('../use-projects', () => ({
  useProjects: vi.fn(() => ({
    projects: [],
    recentCompletionWindowMs: 14400000,
    loading: false,
    error: undefined,
    refresh: mockRefresh,
  })),
}));

// Mock usePersistedState to behave like useState
vi.mock('../use-persisted-state', () => ({
  usePersistedState: <T>(key: string, defaultValue: T) => {
    const { useState } = require('react');
    return useState<T>(defaultValue);
  },
}));

// Import the mocked module so we can change its return value
import { useProjects } from '../use-projects';
const mockedUseProjects = vi.mocked(useProjects);

describe('useRunDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseProjects.mockReturnValue({
      projects: [],
      recentCompletionWindowMs: 14400000,
      loading: false,
      error: undefined,
      refresh: mockRefresh,
    });
  });

  it('returns default state when no projects', () => {
    const { result } = renderHook(() => useRunDashboard());

    expect(result.current.projects).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeUndefined();
    expect(result.current.statusFilter).toBe('all');
    expect(result.current.sortMode).toBe('status');
    expect(result.current.metrics.totalRuns).toBe(0);
    expect(result.current.hasStaleRuns).toBe(false);
  });

  it('aggregates metrics from multiple projects', () => {
    mockedUseProjects.mockReturnValue({
      projects: [
        createMockProjectSummary({ totalRuns: 10, activeRuns: 3, completedRuns: 5, failedRuns: 2, staleRuns: 1 }),
        createMockProjectSummary({ totalRuns: 8, activeRuns: 1, completedRuns: 6, failedRuns: 1, staleRuns: 0 }),
      ],
      recentCompletionWindowMs: 14400000,
      loading: false,
      error: undefined,
      refresh: mockRefresh,
    });

    const { result } = renderHook(() => useRunDashboard());

    expect(result.current.metrics.totalRuns).toBe(18);
    expect(result.current.metrics.activeRuns).toBe(4);
    expect(result.current.metrics.completedRuns).toBe(11);
    expect(result.current.metrics.failedRuns).toBe(3);
    expect(result.current.metrics.staleRuns).toBe(1);
    expect(result.current.hasStaleRuns).toBe(true);
  });

  it('toggleMetricFilter toggles between filter and "all"', () => {
    const { result } = renderHook(() => useRunDashboard());

    act(() => {
      result.current.toggleMetricFilter('failed');
    });
    expect(result.current.statusFilter).toBe('failed');

    act(() => {
      result.current.toggleMetricFilter('failed');
    });
    expect(result.current.statusFilter).toBe('all');
  });

  it('filters projects by status', () => {
    mockedUseProjects.mockReturnValue({
      projects: [
        createMockProjectSummary({ projectName: 'a', failedRuns: 2, activeRuns: 0 }),
        createMockProjectSummary({ projectName: 'b', failedRuns: 0, activeRuns: 1 }),
      ],
      recentCompletionWindowMs: 14400000,
      loading: false,
      error: undefined,
      refresh: mockRefresh,
    });

    const { result } = renderHook(() => useRunDashboard());

    act(() => {
      result.current.setStatusFilter('failed');
    });

    expect(result.current.filteredProjects).toHaveLength(1);
    expect(result.current.filteredProjects[0].projectName).toBe('a');
  });

  it('handleHideProject calls refresh', () => {
    const { result } = renderHook(() => useRunDashboard());

    act(() => {
      result.current.handleHideProject('some-project');
    });

    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  it('maps stale statusFilter to "all" for cardStatusFilter', () => {
    const { result } = renderHook(() => useRunDashboard());

    act(() => {
      result.current.setStatusFilter('stale');
    });

    expect(result.current.cardStatusFilter).toBe('all');
  });

  it('computes filterCounts from metrics', () => {
    mockedUseProjects.mockReturnValue({
      projects: [
        createMockProjectSummary({ totalRuns: 15, activeRuns: 3, completedRuns: 10, failedRuns: 2, staleRuns: 1 }),
      ],
      recentCompletionWindowMs: 14400000,
      loading: false,
      error: undefined,
      refresh: mockRefresh,
    });

    const { result } = renderHook(() => useRunDashboard());

    expect(result.current.filterCounts.all).toBe(15);
    expect(result.current.filterCounts.waiting).toBe(3);
    expect(result.current.filterCounts.completed).toBe(10);
    expect(result.current.filterCounts.failed).toBe(2);
    expect(result.current.filterCounts.stale).toBe(1);
  });

  it('sums orphaned filterCount from per-project orphanedRuns aggregate', () => {
    mockedUseProjects.mockReturnValue({
      projects: [
        createMockProjectSummary({ projectName: 'a', orphanedRuns: 2 }),
        createMockProjectSummary({ projectName: 'b', orphanedRuns: 3 }),
        createMockProjectSummary({ projectName: 'c', orphanedRuns: 0 }),
      ],
      recentCompletionWindowMs: 14400000,
      loading: false,
      error: undefined,
      refresh: mockRefresh,
    });

    const { result } = renderHook(() => useRunDashboard());

    // Badge count must equal the orphaned LIST length (2 + 3 + 0 = 5).
    expect(result.current.filterCounts.orphaned).toBe(5);
  });

  it('filters projects by orphaned using the orphanedRuns aggregate', () => {
    mockedUseProjects.mockReturnValue({
      projects: [
        createMockProjectSummary({ projectName: 'has-orphan', orphanedRuns: 1 }),
        createMockProjectSummary({ projectName: 'no-orphan', orphanedRuns: 0 }),
      ],
      recentCompletionWindowMs: 14400000,
      loading: false,
      error: undefined,
      refresh: mockRefresh,
    });

    const { result } = renderHook(() => useRunDashboard());

    act(() => {
      result.current.setStatusFilter('orphaned');
    });

    expect(result.current.filteredProjects).toHaveLength(1);
    expect(result.current.filteredProjects[0].projectName).toBe('has-orphan');
  });

  it('computes bannerFingerprint from issue metrics', () => {
    mockedUseProjects.mockReturnValue({
      projects: [
        createMockProjectSummary({ failedRuns: 2, staleRuns: 1 }),
      ],
      recentCompletionWindowMs: 14400000,
      loading: false,
      error: undefined,
      refresh: mockRefresh,
    });

    const { result } = renderHook(() => useRunDashboard());

    // fingerprint format: failedRuns-staleRuns-pendingBreakpoints
    expect(result.current.bannerFingerprint).toBe('2-1-0');
  });

  // QA F4: hiddenProjects must not silently swallow needs-you. Hiding affects
  // the project grid only — the alarm surface (banner + needs-you counts)
  // still includes hidden projects.
  describe('hidden projects (QA F4)', () => {
    const hiddenBp = {
      runId: 'run-hidden-1',
      effectId: 'eff-1',
      projectName: 'wc26-pool',
      processId: 'proc-1',
      breakpointQuestion: 'Deploy?',
    };

    beforeEach(() => {
      mockedUseProjects.mockReturnValue({
        projects: [
          createMockProjectSummary({ projectName: 'visible-a', pendingBreakpoints: 2 }),
          createMockProjectSummary({ projectName: 'visible-b', pendingBreakpoints: 1 }),
          createMockProjectSummary({
            projectName: 'wc26-pool',
            hidden: true,
            pendingBreakpoints: 1,
            breakpointRuns: [hiddenBp],
            totalRuns: 4,
          }),
        ],
        recentCompletionWindowMs: 14400000,
        loading: false,
        error: undefined,
        refresh: mockRefresh,
      });
    });

    it('includes hidden projects in the breakpoint banner list', () => {
      const { result } = renderHook(() => useRunDashboard());
      expect(result.current.allBreakpointRuns).toContainEqual(hiddenBp);
    });

    it('includes hidden projects in the needs-you count (banner says truth: 4, not 3)', () => {
      const { result } = renderHook(() => useRunDashboard());
      expect(result.current.filterCounts.needsyou).toBe(4);
      expect(result.current.summaryMetrics.pendingBreakpoints).toBe(4);
    });

    it('excludes hidden projects from the grid and grid metrics', () => {
      const { result } = renderHook(() => useRunDashboard());
      // statusFilter defaults to "all" → grid view
      expect(result.current.filteredProjects.map((p) => p.projectName)).toEqual([
        'visible-a',
        'visible-b',
      ]);
      // KPI totals only cover visible projects (default fixture totalRuns=10)
      expect(result.current.metrics.totalRuns).toBe(20);
      expect(result.current.summaryMetrics.totalProjects).toBe(2);
    });

    it('surfaces hidden projects under the needs-you filter so count === list', () => {
      const { result } = renderHook(() => useRunDashboard());
      act(() => {
        result.current.setStatusFilter('needsyou');
      });
      expect(result.current.filteredProjects.map((p) => p.projectName)).toContain('wc26-pool');
    });

    it('exposes hiddenProjectCount for the "N hidden" indicator', () => {
      const { result } = renderHook(() => useRunDashboard());
      expect(result.current.hiddenProjectCount).toBe(1);
    });
  });
});
