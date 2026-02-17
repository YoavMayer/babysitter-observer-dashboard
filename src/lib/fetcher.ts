// ---------------------------------------------------------------------------
// resilientFetch  --  shared HTTP client with retry, timeout & abort support
// ---------------------------------------------------------------------------

/** Normalized error shape returned on failure. */
export interface FetchError {
  /** HTTP status code, or 0 for network / timeout / abort errors. */
  status: number;
  /** Human-readable description of what went wrong. */
  message: string;
  /** Whether the request was (or could have been) retried. */
  isRetryable: boolean;
  /** Whether the request was cancelled via an AbortSignal. */
  isAborted: boolean;
}

/** Options accepted by {@link resilientFetch}. */
export interface FetchOptions {
  /** Optional external AbortSignal (e.g. from a hook cleanup). */
  signal?: AbortSignal;
  /** Maximum number of retry attempts for retryable errors (default 2). */
  retries?: number;
  /** Base delay in ms for exponential backoff (default 1000). */
  retryDelay?: number;
  /** Request timeout in ms (default 10000). */
  timeout?: number;
  /** HTTP method (default "GET"). */
  method?: string;
  /** Additional request headers. */
  headers?: Record<string, string>;
  /** Request body (stringified JSON, form data, etc.). */
  body?: string;
}

/** Discriminated union representing a successful or failed fetch. */
export type FetchResult<T> =
  | { ok: true; data: T; status: number }
  | { ok: false; error: FetchError };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isRetryableStatus(status: number): boolean {
  return status >= 500;
}

function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError";
}

/**
 * Sleep for `ms` milliseconds. Resolves early (with rejection) when the
 * provided signal is aborted so we don't keep waiting between retries after
 * the caller has cancelled the request.
 */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
      return;
    }

    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);

    const onAbort = () => {
      clearTimeout(timer);
      reject(signal!.reason ?? new DOMException("Aborted", "AbortError"));
    };

    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/**
 * Create a merged AbortSignal that fires when *either* the timeout elapses
 * **or** the external signal is aborted.  Returns the merged signal together
 * with a cleanup function that **must** be called after every attempt to
 * prevent timer leaks.
 */
function createMergedSignal(
  timeout: number,
  externalSignal?: AbortSignal,
): { signal: AbortSignal; cleanup: () => void } {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;

  timer = setTimeout(() => {
    controller.abort(new DOMException("Request timed out", "TimeoutError"));
  }, timeout);

  const onExternalAbort = () => {
    clearTimeout(timer);
    controller.abort(
      externalSignal!.reason ??
        new DOMException("Aborted", "AbortError"),
    );
  };

  if (externalSignal?.aborted) {
    clearTimeout(timer);
    controller.abort(
      externalSignal.reason ??
        new DOMException("Aborted", "AbortError"),
    );
  } else {
    externalSignal?.addEventListener("abort", onExternalAbort, { once: true });
  }

  const cleanup = () => {
    clearTimeout(timer);
    externalSignal?.removeEventListener("abort", onExternalAbort);
  };

  return { signal: controller.signal, cleanup };
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Perform an HTTP fetch with built-in **retry**, **timeout**, and **abort**
 * support.  Returns a discriminated-union result so callers never need to
 * catch exceptions.
 *
 * Retry behaviour:
 * - Network errors and 5xx responses are retried up to `options.retries`
 *   times (default 2) with exponential backoff starting at
 *   `options.retryDelay` ms (default 1000).
 * - 4xx (client) errors are **not** retried.
 *
 * Abort / timeout:
 * - An internal AbortController enforces `options.timeout` (default 10 000 ms).
 * - If `options.signal` is provided it is merged with the internal timeout
 *   signal; aborting either one cancels the in-flight request immediately.
 *
 * @example
 * ```ts
 * const result = await resilientFetch<Run[]>("/api/runs");
 * if (result.ok) {
 *   console.log(result.data);
 * } else {
 *   console.error(result.error.message);
 * }
 * ```
 */
export async function resilientFetch<T>(
  url: string,
  options: FetchOptions = {},
): Promise<FetchResult<T>> {
  const {
    signal: externalSignal,
    retries = 2,
    retryDelay = 1000,
    timeout = 10_000,
    method = "GET",
    headers,
    body,
  } = options;

  let lastError: FetchError | undefined;

  for (let attempt = 0; attempt <= retries; attempt++) {
    // Create a per-attempt merged signal (timeout + external abort).
    const { signal, cleanup } = createMergedSignal(timeout, externalSignal);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body,
        signal,
      });

      if (response.ok) {
        let data: T;
        try {
          data = (await response.json()) as T;
        } catch {
          cleanup();
          return {
            ok: false,
            error: {
              status: response.status,
              message: `Expected JSON response from ${url}`,
              isRetryable: false,
              isAborted: false,
            },
          };
        }
        cleanup();
        return { ok: true, data, status: response.status };
      }

      // Non-OK response -- build an error object.
      const retryable = isRetryableStatus(response.status);
      let errorMessage: string;
      try {
        const text = await response.text();
        errorMessage = text || `HTTP ${response.status}`;
      } catch {
        errorMessage = `HTTP ${response.status}`;
      }

      cleanup();

      lastError = {
        status: response.status,
        message: errorMessage,
        isRetryable: retryable,
        isAborted: false,
      };

      // 4xx errors are not retried -- return immediately.
      if (!retryable) {
        return { ok: false, error: lastError };
      }

      // If this was the final attempt, don't sleep -- fall through to return.
      if (attempt < retries) {
        const delay = retryDelay * Math.pow(2, attempt);
        await sleep(delay, externalSignal);
      }
    } catch (err: unknown) {
      cleanup();

      // Determine if this was a timeout by inspecting the merged signal's
      // abort reason.  We set a DOMException with name "TimeoutError" as
      // the reason in createMergedSignal, so we can reliably distinguish
      // timeout from user-initiated abort regardless of how the environment
      // surfaces the thrown error.
      if (isAbortError(err) || (err instanceof DOMException && err.name === "TimeoutError")) {
        const reason = signal.reason;
        const isTimeout =
          reason instanceof DOMException && reason.name === "TimeoutError";

        return {
          ok: false,
          error: {
            status: 0,
            message: isTimeout ? "Request timed out" : "Request aborted",
            isRetryable: false,
            isAborted: !isTimeout,
          },
        };
      }

      // Network error -- retryable.
      lastError = {
        status: 0,
        message: err instanceof Error ? err.message : "Network error",
        isRetryable: true,
        isAborted: false,
      };

      if (attempt < retries) {
        try {
          const delay = retryDelay * Math.pow(2, attempt);
          await sleep(delay, externalSignal);
        } catch {
          // Sleep was aborted -- the caller cancelled.
          return {
            ok: false,
            error: {
              status: 0,
              message: "Request aborted",
              isRetryable: false,
              isAborted: true,
            },
          };
        }
      }
    }
  }

  // All retries exhausted.
  return {
    ok: false,
    error: lastError ?? {
      status: 0,
      message: "Unknown error",
      isRetryable: false,
      isAborted: false,
    },
  };
}
