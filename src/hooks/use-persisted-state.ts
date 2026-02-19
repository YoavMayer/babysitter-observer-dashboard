"use client";
import { useState, useEffect, useCallback, useRef } from "react";

const NAMESPACE = "observer:";

/**
 * Custom hook that wraps useState with localStorage persistence.
 * Values are serialized with JSON.stringify/parse and namespaced
 * under the "observer:" prefix to avoid collisions.
 *
 * Hydration-safe: always renders defaultValue on the first paint
 * (matching SSR), then syncs from localStorage after hydration.
 */
export function usePersistedState<T>(
  key: string,
  defaultValue: T
): [T, (value: T | ((prev: T) => T)) => void] {
  const prefixedKey = key.startsWith(NAMESPACE) ? key : `${NAMESPACE}${key}`;
  const hydrated = useRef(false);

  const [state, setState] = useState<T>(defaultValue);

  // Sync from localStorage after hydration (client only)
  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    try {
      const stored = window.localStorage.getItem(prefixedKey);
      if (stored !== null) {
        setState(JSON.parse(stored) as T);
      }
    } catch {
      // localStorage unavailable — keep default
    }
  }, [prefixedKey]);

  const setPersistedState = useCallback(
    (value: T | ((prev: T) => T)) => {
      setState((prev) => {
        const next = typeof value === "function" ? (value as (prev: T) => T)(prev) : value;
        try {
          if (typeof window !== "undefined") {
            window.localStorage.setItem(prefixedKey, JSON.stringify(next));
          }
        } catch {
          // localStorage may be full or blocked — silently ignore
        }
        return next;
      });
    },
    [prefixedKey]
  );

  return [state, setPersistedState];
}
