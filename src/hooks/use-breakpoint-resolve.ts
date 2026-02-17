"use client";
import { useState, useCallback } from "react";
import type { BreakpointResolveResponse } from "@/types";

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function useBreakpointResolve() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolved, setResolved] = useState(false);

  const resolve = useCallback(
    async (runId: string, effectId: string, approved: boolean, value?: string) => {
      setLoading(true);
      setError(null);

      let lastError: Error | null = null;

      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          if (attempt > 0) {
            await delay(RETRY_DELAY_MS * attempt);
          }

          const res = await fetch(`/api/runs/${runId}/tasks/${effectId}/resolve`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ approved, value }),
          });

          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            const msg = (body as { error?: string }).error || `HTTP ${res.status}`;
            // Don't retry on 400/404/409 (client errors)
            if (res.status >= 400 && res.status < 500) {
              throw new Error(msg);
            }
            lastError = new Error(msg);
            continue;
          }

          const data: BreakpointResolveResponse = await res.json();
          if (!data.success) {
            throw new Error(data.error || "Resolution failed");
          }
          setResolved(true);
          setLoading(false);
          return data;
        } catch (err) {
          lastError = err instanceof Error ? err : new Error("Unknown error");
          // Don't retry client errors
          if (lastError.message.includes("HTTP 4")) {
            break;
          }
        }
      }

      const message = lastError?.message || "Unknown error";
      setError(message);
      setLoading(false);
      throw lastError;
    },
    []
  );

  const clearError = useCallback(() => setError(null), []);

  return { resolve, loading, error, resolved, clearError };
}
