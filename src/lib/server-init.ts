import { EventEmitter } from "events";
import { initWatcher, watcherEvents, type WatcherEvent } from "./watcher";
import { discoverAndCacheAll, forceRefreshBreakpointRuns } from "./run-cache";

// Shared event bus for SSE endpoints — persist across HMR
const SERVER_EVENTS_KEY = '__observer_server_events__';
function getServerEvents(): EventEmitter {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!(globalThis as any)[SERVER_EVENTS_KEY]) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any)[SERVER_EVENTS_KEY] = new EventEmitter();
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (globalThis as any)[SERVER_EVENTS_KEY];
}

export const serverEvents = getServerEvents();

// Persist initialization state across HMR reloads via globalThis
const INIT_KEY = '__observer_init__';

interface InitState {
  initialized: boolean;
  initPromise: Promise<void> | null;
  cleanup: (() => void) | null;
}

function getInitState(): InitState {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!(globalThis as any)[INIT_KEY]) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any)[INIT_KEY] = {
      initialized: false,
      initPromise: null,
      cleanup: null,
    };
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (globalThis as any)[INIT_KEY];
}

export async function ensureInitialized(): Promise<void> {
  const state = getInitState();

  // Already initialized
  if (state.initialized) {
    return;
  }

  // Initialization in progress
  if (state.initPromise) {
    return state.initPromise;
  }

  // Start initialization
  state.initPromise = (async () => {
    try {
      console.log("Starting server initialization...");

      // Step 1: Initialize watcher
      console.log("Setting up filesystem watcher...");
      state.cleanup = await initWatcher();

      // Step 2: Initial cache population
      console.log("Populating cache with discovered runs...");
      await discoverAndCacheAll();

      // Step 3: Listen to watcher events and broadcast
      // Watcher already invalidates the specific run cache in handleJournalChange.
      // Additionally, when a journal change is detected, force-refresh all breakpoint
      // cache entries. This ensures that EFFECT_RESOLVED events for breakpoints
      // immediately clear stale breakpoint data across all cached runs — not just
      // the specific run that changed.
      watcherEvents.on("change", (event: WatcherEvent) => {
        if (event.type === "run-changed") {
          // Eagerly invalidate all breakpoint-related cache entries so
          // resolved breakpoints don't linger in the dashboard banner
          forceRefreshBreakpointRuns();
          serverEvents.emit("run-changed", event);
        } else if (event.type === "new-run") {
          serverEvents.emit("new-run", event);
        } else if (event.type === "error") {
          serverEvents.emit("error", event);
        }
      });

      state.initialized = true;
      console.log("Server initialization complete");
    } catch (err) {
      console.error("Server initialization failed:", err);
      state.initPromise = null;
      throw err;
    }
  })();

  return state.initPromise;
}

// Cleanup function for graceful shutdown
export async function shutdownServer(): Promise<void> {
  const state = getInitState();

  if (state.cleanup) {
    state.cleanup();
    state.cleanup = null;
  }

  state.initialized = false;
  state.initPromise = null;

  // Remove all event listeners
  serverEvents.removeAllListeners();

  console.log("Server shutdown complete");
}

// Get initialization status for debugging
export function getInitStatus() {
  const state = getInitState();
  return {
    initialized: state.initialized,
    hasCleanup: !!state.cleanup,
    serverEventListeners: serverEvents.eventNames().length,
  };
}
