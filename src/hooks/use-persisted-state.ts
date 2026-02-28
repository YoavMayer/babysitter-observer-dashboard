"use client";
import { useState, useCallback } from "react";

const NAMESPACE = "observer:";

/**
 * Custom hook that wraps useState with localStorage persistence.
 * Values are serialized with JSON.stringify/parse and namespaced
 * under the "observer:" prefix to avoid collisions.
 *
 * Reads localStorage synchronously via a lazy initializer so the
 * first render already reflects the persisted value (no flash).
 */
export function usePersistedState<T>(
  key: string,
  defaultValue: T
): [T, (value: T | ((prev: T) => T)) => void] {
  const prefixedKey = key.startsWith(NAMESPACE) ? key : `${NAMESPACE}${key}`;

  const [state, setState] = useState<T>(() => {
    if (typeof window === "undefined") return defaultValue;
    try {
      const stored = window.localStorage.getItem(prefixedKey);
      if (stored !== null) return JSON.parse(stored) as T;
    } catch {
      // localStorage unavailable — keep default
    }
    return defaultValue;
  });

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
