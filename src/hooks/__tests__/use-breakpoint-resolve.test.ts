import { renderHook, act } from '@testing-library/react';
import { useBreakpointResolve } from '../use-breakpoint-resolve';

function mockFetchSuccess(data: unknown) {
  return vi.fn().mockImplementation(() =>
    Promise.resolve(
      new Response(JSON.stringify(data), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )
  );
}

// Helper: flush microtasks by awaiting a resolved promise
function _flushMicrotasks() {
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
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved: true, value: 'yes please' }),
      })
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
      resolveFetch(
        new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );
      await resolvePromise!;
    });

    expect(result.current.loading).toBe(false);
  });

  it('handles HTTP 400 error without retry when no custom error message', async () => {
    // When server returns no custom error body, the hook falls back to "HTTP 400"
    // resilientFetch reads response.text() for errors; empty text falls back to "HTTP 400"
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() =>
        Promise.resolve(new Response('', { status: 400 }))
      )
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

  it('handles HTTP 404 error with retry (404 is retryable for HMR)', async () => {
    // 404 is retryable in resilientFetch due to Next.js HMR transient 404s
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() =>
        Promise.resolve(new Response('', { status: 404 }))
      )
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
    // 404 is retryable: 1 initial + 2 retries = 3
    expect(fetch).toHaveBeenCalledTimes(3);
  }, 15000);

  it('retries on 500 server error up to MAX_RETRIES', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() =>
        Promise.resolve(new Response('Server error', { status: 500 }))
      )
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
      .mockResolvedValueOnce(new Response('Server error', { status: 500 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );
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
      vi.fn().mockImplementation(() =>
        Promise.resolve(
          new Response(JSON.stringify({ success: false, error: 'Resolution failed' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        )
      )
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
      vi.fn().mockImplementation(() =>
        Promise.resolve(new Response('Bad request', { status: 400 }))
      )
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
