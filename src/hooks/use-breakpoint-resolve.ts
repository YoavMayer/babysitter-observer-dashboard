"use client";
import { useState, useCallback, useRef, useEffect } from "react";
import { resilientFetch } from "@/lib/fetcher";
import type { BreakpointResolveResponse } from "@/types";

export function useBreakpointResolve() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolved, setResolved] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Abort any in-flight request on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const resolve = useCallback(
    async (runId: string, effectId: string, approved: boolean, value?: string) => {
      setLoading(true);
      setError(null);

      // Cancel any previous in-flight resolve request
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const result = await resilientFetch<BreakpointResolveResponse>(
        `/api/runs/${runId}/tasks/${effectId}/resolve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ approved, value }),
          signal: controller.signal,
          retries: 2,
          retryDelay: 1000,
        },
      );

      if (!result.ok) {
        // If the request was aborted (e.g. unmount), bail out silently
        if (result.error.isAborted) return;

        const message = result.error.message || "Unknown error";
        setError(message);
        setLoading(false);
        throw new Error(message);
      }

      const data = result.data;
      if (!data.success) {
        const message = data.error || "Resolution failed";
        setError(message);
        setLoading(false);
        throw new Error(message);
      }

      setResolved(true);
      setLoading(false);
      return data;
    },
    [],
  );

  const clearError = useCallback(() => setError(null), []);

  return { resolve, loading, error, resolved, clearError };
}
