"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { subscribe, StreamEvent } from "./use-event-stream";

interface UseSmartPollingOptions {
  interval?: number;
  sseFilter?: (event: StreamEvent) => boolean;
  enabled?: boolean;
}

export function useSmartPolling<T>(
  url: string,
  options: UseSmartPollingOptions = {}
) {
  const { interval = 5000, sseFilter, enabled = true } = options;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(enabled && !!url);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const sseFilterRef = useRef(sseFilter);
  sseFilterRef.current = sseFilter;
  const sseConnected = useRef(false);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async () => {
    if (!url || !enabled) return;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (mountedRef.current) {
        setData(json);
        setError(null);
        setLoading(false);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : "Unknown error");
        setLoading(false);
      }
    }
  }, [url, enabled]);

  // Polling: slower when SSE connected (30s heartbeat), normal interval when disconnected
  useEffect(() => {
    mountedRef.current = true;
    if (!enabled || !url) {
      setLoading(false);
      return;
    }

    setLoading(true);
    fetchData();

    // Start poll timer — use longer interval when SSE connected, normal when not
    function startPoll() {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      const pollInterval = sseConnected.current ? Math.max(interval * 3, 15000) : interval;
      pollTimerRef.current = setInterval(fetchData, pollInterval);
    }

    startPoll();

    return () => {
      mountedRef.current = false;
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [fetchData, interval, enabled, url]);

  // SSE subscription: triggers immediate refresh on matching events
  useEffect(() => {
    if (!enabled || !sseFilterRef.current) return;

    const unsubscribe = subscribe((event: StreamEvent) => {
      // Track SSE connection state
      if (event.type === "connected") {
        if (!sseConnected.current) {
          sseConnected.current = true;
          // Restart poll with longer interval since SSE is active
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          const slowInterval = Math.max(interval * 3, 15000);
          pollTimerRef.current = setInterval(fetchData, slowInterval);
        }
        return;
      }

      // On SSE disconnect (error event or timeout), reset to normal polling
      if (event.type === "error") {
        if (sseConnected.current) {
          sseConnected.current = false;
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          pollTimerRef.current = setInterval(fetchData, interval);
        }
        return;
      }

      // Apply filter and trigger immediate refresh
      if (sseFilterRef.current?.(event)) {
        fetchData();
      }
    });

    return () => {
      unsubscribe();
      sseConnected.current = false;
    };
  }, [enabled, fetchData, interval]);

  return { data, loading, error, refresh: fetchData };
}
