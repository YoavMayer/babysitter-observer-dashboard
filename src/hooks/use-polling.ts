"use client";
import { useState, useEffect, useCallback, useRef } from "react";

interface UsePollingOptions {
  interval?: number;
  enabled?: boolean;
}

export function usePolling<T>(
  url: string,
  options: UsePollingOptions = {}
): { data: T | null; loading: boolean; error: string | null; refresh: () => void } {
  const { interval = 2000, enabled = true } = options;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(enabled && !!url);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const fetchData = useCallback(async () => {
    if (!url) return;
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
  }, [url]);

  useEffect(() => {
    mountedRef.current = true;
    if (!enabled || !url) {
      setLoading(false);
      return;
    }

    setLoading(true);
    fetchData();
    const id = setInterval(fetchData, interval);

    return () => {
      mountedRef.current = false;
      clearInterval(id);
    };
  }, [fetchData, interval, enabled, url]);

  return { data, loading, error, refresh: fetchData };
}
