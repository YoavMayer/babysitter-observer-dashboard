import { renderHook, act } from '@testing-library/react';
import { useBreakpointResolve } from '../use-breakpoint-resolve';

function mockFetchSuccess(data: unknown) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(data),
  });
}

// Helper: flush microtasks by awaiting a resolved promise
function flushMicrotasks() {
  return new Promise<void>((resolve) => resolve());
}

describe('useBreakpointResolve', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      mockFetchSuccess({ success: true })
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts with idle state', () => {
    const { result } = renderHook(() => useBreakpointResolve());

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.resolved).toBe(false);
  });

  it('sends POST request to resolve endpoint with approved=true', async () => {
    const { result } = renderHook(() => useBreakpointResolve());

    await act(async () => {
      await result.current.resolve('run-1', 'eff-1', true, 'yes please');
    });

    expect(fetch).toHaveBeenCalledWith(
      '/api/runs/run-1/tasks/eff-1/resolve',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved: true, value: 'yes please' }),
      }
    );
    expect(result.current.resolved).toBe(true);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('sends POST request with approved=false (reject)', async () => {
    const { result } = renderHook(() => useBreakpointResolve());

    await act(async () => {
      await result.current.resolve('run-1', 'eff-1', false);
    });

    expect(fetch).toHaveBeenCalledWith(
      '/api/runs/run-1/tasks/eff-1/resolve',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ approved: false, value: undefined }),
      })
    );
    expect(result.current.resolved).toBe(true);
  });

  it('sets loading to true during request', async () => {
    let resolveFetch!: (v: unknown) => void;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockReturnValue(
        new Promise((resolve) => {
          resolveFetch = resolve;
        })
      )
    );

    const { result } = renderHook(() => useBreakpointResolve());

    let resolvePromise: Promise<unknown>;
    act(() => {
      resolvePromise = result.current.resolve('run-1', 'eff-1', true);
    });

    expect(result.current.loading).toBe(true);

    await act(async () => {
      resolveFetch({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });
      await resolvePromise!;
    });

    expect(result.current.loading).toBe(false);
  });

  it('handles HTTP 400 error without retry when no custom error message', async () => {
    // When server returns no custom error body, the hook falls back to "HTTP 400"
    // which matches the "HTTP 4" check and breaks immediately (no retries)
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({}),
      })
    );

    const { result } = renderHook(() => useBreakpointResolve());

    let caughtError: Error | null = null;
    await act(async () => {
      try {
        await result.current.resolve('run-1', 'eff-1', true);
      } catch (err) {
        caughtError = err as Error;
      }
    });

    expect(caughtError).not.toBeNull();
    expect(caughtError!.message).toBe('HTTP 400');
    expect(result.current.error).toBe('HTTP 400');
    expect(result.current.loading).toBe(false);
    // Should only be called once (no retries for client errors with "HTTP 4xx" message)
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('handles HTTP 404 error without retry when no custom error message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: () => Promise.resolve({}),
      })
    );

    const { result } = renderHook(() => useBreakpointResolve());

    let caughtError: Error | null = null;
    await act(async () => {
      try {
        await result.current.resolve('run-1', 'eff-1', true);
      } catch (err) {
        caughtError = err as Error;
      }
    });

    expect(caughtError).not.toBeNull();
    expect(caughtError!.message).toBe('HTTP 404');
    expect(result.current.error).toBe('HTTP 404');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('retries on 500 server error up to MAX_RETRIES', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'Server error' }),
      })
    );

    const { result } = renderHook(() => useBreakpointResolve());

    let caughtError: Error | null = null;
    // Use real timers - the retry delays (1s, 2s) will complete naturally
    // Use a longer timeout for this test
    await act(async () => {
      try {
        await result.current.resolve('run-1', 'eff-1', true);
      } catch (err) {
        caughtError = err as Error;
      }
    });

    expect(caughtError).not.toBeNull();
    expect(caughtError!.message).toBe('Server error');
    // 1 initial + 2 retries = 3 total
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(result.current.error).toBe('Server error');
    expect(result.current.loading).toBe(false);
  }, 15000);

  it('succeeds on retry after initial server error', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'Server error' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useBreakpointResolve());

    await act(async () => {
      await result.current.resolve('run-1', 'eff-1', true);
    });

    expect(result.current.resolved).toBe(true);
    expect(result.current.error).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(2);
  }, 10000);

  it('handles response with success=false', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: false, error: 'Resolution failed' }),
      })
    );

    const { result } = renderHook(() => useBreakpointResolve());

    let caughtError: Error | null = null;
    await act(async () => {
      try {
        await result.current.resolve('run-1', 'eff-1', true);
      } catch (err) {
        caughtError = err as Error;
      }
    });

    expect(caughtError).not.toBeNull();
    expect(caughtError!.message).toBe('Resolution failed');
    expect(result.current.error).toBe('Resolution failed');
  });

  it('clearError resets error state', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ error: 'Bad request' }),
      })
    );

    const { result } = renderHook(() => useBreakpointResolve());

    await act(async () => {
      try {
        await result.current.resolve('run-1', 'eff-1', true);
      } catch {
        // expected
      }
    });

    expect(result.current.error).toBe('Bad request');

    act(() => {
      result.current.clearError();
    });

    expect(result.current.error).toBeNull();
  });

  it('returns response data on success', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetchSuccess({ success: true, extra: 'data' })
    );

    const { result } = renderHook(() => useBreakpointResolve());

    let response: unknown;
    await act(async () => {
      response = await result.current.resolve('run-1', 'eff-1', true);
    });

    expect(response).toEqual({ success: true, extra: 'data' });
  });
});
