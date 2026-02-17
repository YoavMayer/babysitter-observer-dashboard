import { renderHook, act } from '@testing-library/react';
import { createMockProjectSummary } from '@/test/fixtures';
import { useProjects } from '../use-projects';

type MockEventSourceInstance = {
  onopen: ((event: Event) => void) | null;
  onmessage: ((event: MessageEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  close: ReturnType<typeof vi.fn>;
  readyState: number;
  url: string;
};

let mockEventSourceInstances: MockEventSourceInstance[] = [];

class MockEventSource {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSED = 2;

  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  close = vi.fn();
  readyState = MockEventSource.OPEN;
  url: string;

  constructor(url: string) {
    this.url = url;
    mockEventSourceInstances.push(this);
  }
}

const mockProjects = [
  createMockProjectSummary({ projectName: 'project-a', totalRuns: 5 }),
  createMockProjectSummary({ projectName: 'project-b', totalRuns: 3 }),
];

describe('useProjects', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockEventSourceInstances = [];
    vi.stubGlobal('EventSource', MockEventSource);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            projects: mockProjects,
          }),
      })
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('fetches project list and returns data', async () => {
    const { result } = renderHook(() => useProjects());

    expect(result.current.loading).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current.projects).toHaveLength(2);
    expect(result.current.projects[0].projectName).toBe('project-a');
    expect(result.current.projects[1].projectName).toBe('project-b');
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('calls /api/runs?mode=projects endpoint', async () => {
    renderHook(() => useProjects());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(fetch).toHaveBeenCalledWith('/api/runs?mode=projects');
  });

  it('uses custom interval', async () => {
    renderHook(() => useProjects(10000));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(fetch).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('returns empty projects array when data is null', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(null),
      })
    );

    const { result } = renderHook(() => useProjects());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current.projects).toEqual([]);
  });

  it('handles fetch error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        json: () => Promise.resolve({}),
      })
    );

    const { result } = renderHook(() => useProjects());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current.error).toBe('HTTP 503');
    expect(result.current.projects).toEqual([]);
  });

  it('provides a refresh function', async () => {
    const { result } = renderHook(() => useProjects());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(fetch).toHaveBeenCalledTimes(1);

    await act(async () => {
      result.current.refresh();
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
