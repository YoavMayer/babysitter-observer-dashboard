import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('../watcher', () => {
  const { EventEmitter } = require('events');
  return {
    initWatcher: vi.fn(),
    watcherEvents: new EventEmitter(),
  };
});

vi.mock('../run-cache', () => ({
  discoverAndCacheAll: vi.fn(),
}));

import { initWatcher, watcherEvents } from '../watcher';
import { discoverAndCacheAll } from '../run-cache';
import {
  ensureInitialized,
  shutdownServer,
  getInitStatus,
  serverEvents,
} from '../server-init';

const mockInitWatcher = vi.mocked(initWatcher);
const mockDiscoverAndCacheAll = vi.mocked(discoverAndCacheAll);

describe('server-init', () => {
  beforeEach(async () => {
    vi.resetAllMocks();
    // Reset server state between tests
    await shutdownServer();
    watcherEvents.removeAllListeners();
  });

  // -----------------------------------------------------------------------
  // ensureInitialized
  // -----------------------------------------------------------------------
  describe('ensureInitialized', () => {
    it('initializes watcher and populates cache on first call', async () => {
      const cleanupMock = vi.fn();
      mockInitWatcher.mockResolvedValue(cleanupMock);
      mockDiscoverAndCacheAll.mockResolvedValue(undefined);

      await ensureInitialized();

      expect(mockInitWatcher).toHaveBeenCalledTimes(1);
      expect(mockDiscoverAndCacheAll).toHaveBeenCalledTimes(1);
    });

    it('returns immediately on subsequent calls', async () => {
      const cleanupMock = vi.fn();
      mockInitWatcher.mockResolvedValue(cleanupMock);
      mockDiscoverAndCacheAll.mockResolvedValue(undefined);

      await ensureInitialized();
      await ensureInitialized();
      await ensureInitialized();

      // Should only initialize once
      expect(mockInitWatcher).toHaveBeenCalledTimes(1);
      expect(mockDiscoverAndCacheAll).toHaveBeenCalledTimes(1);
    });

    it('deduplicates concurrent initialization calls', async () => {
      const cleanupMock = vi.fn();
      mockInitWatcher.mockResolvedValue(cleanupMock);
      mockDiscoverAndCacheAll.mockResolvedValue(undefined);

      // Call concurrently
      const [r1, r2, r3] = await Promise.all([
        ensureInitialized(),
        ensureInitialized(),
        ensureInitialized(),
      ]);

      expect(mockInitWatcher).toHaveBeenCalledTimes(1);
    });

    it('throws and resets state if initialization fails', async () => {
      mockInitWatcher.mockRejectedValue(new Error('init failed'));

      await expect(ensureInitialized()).rejects.toThrow('init failed');

      // After failure, should be able to retry
      const cleanupMock = vi.fn();
      mockInitWatcher.mockResolvedValue(cleanupMock);
      mockDiscoverAndCacheAll.mockResolvedValue(undefined);

      await ensureInitialized();

      expect(mockInitWatcher).toHaveBeenCalledTimes(2);
    });
  });

  // -----------------------------------------------------------------------
  // Event forwarding
  // -----------------------------------------------------------------------
  describe('event forwarding', () => {
    it('forwards run-changed events from watcher to server events', async () => {
      const cleanupMock = vi.fn();
      mockInitWatcher.mockResolvedValue(cleanupMock);
      mockDiscoverAndCacheAll.mockResolvedValue(undefined);

      await ensureInitialized();

      const handler = vi.fn();
      serverEvents.on('run-changed', handler);

      watcherEvents.emit('change', { type: 'run-changed', runDir: '/runs/r1' });

      expect(handler).toHaveBeenCalledWith({ type: 'run-changed', runDir: '/runs/r1' });
    });

    it('forwards new-run events from watcher to server events', async () => {
      const cleanupMock = vi.fn();
      mockInitWatcher.mockResolvedValue(cleanupMock);
      mockDiscoverAndCacheAll.mockResolvedValue(undefined);

      await ensureInitialized();

      const handler = vi.fn();
      serverEvents.on('new-run', handler);

      watcherEvents.emit('change', { type: 'new-run', runDir: '/runs' });

      expect(handler).toHaveBeenCalledWith({ type: 'new-run', runDir: '/runs' });
    });

    it('forwards error events from watcher to server events', async () => {
      const cleanupMock = vi.fn();
      mockInitWatcher.mockResolvedValue(cleanupMock);
      mockDiscoverAndCacheAll.mockResolvedValue(undefined);

      await ensureInitialized();

      const handler = vi.fn();
      serverEvents.on('error', handler);

      const errorEvent = { type: 'error', runDir: '/runs', error: new Error('watch error') };
      watcherEvents.emit('change', errorEvent);

      expect(handler).toHaveBeenCalledWith(errorEvent);
    });
  });

  // -----------------------------------------------------------------------
  // shutdownServer
  // -----------------------------------------------------------------------
  describe('shutdownServer', () => {
    it('calls the cleanup function from watcher', async () => {
      const cleanupMock = vi.fn();
      mockInitWatcher.mockResolvedValue(cleanupMock);
      mockDiscoverAndCacheAll.mockResolvedValue(undefined);

      await ensureInitialized();
      await shutdownServer();

      expect(cleanupMock).toHaveBeenCalledTimes(1);
    });

    it('removes all server event listeners', async () => {
      const cleanupMock = vi.fn();
      mockInitWatcher.mockResolvedValue(cleanupMock);
      mockDiscoverAndCacheAll.mockResolvedValue(undefined);

      await ensureInitialized();

      serverEvents.on('run-changed', () => {});
      expect(serverEvents.listenerCount('run-changed')).toBeGreaterThan(0);

      await shutdownServer();

      expect(serverEvents.listenerCount('run-changed')).toBe(0);
    });

    it('allows re-initialization after shutdown', async () => {
      const cleanupMock = vi.fn();
      mockInitWatcher.mockResolvedValue(cleanupMock);
      mockDiscoverAndCacheAll.mockResolvedValue(undefined);

      await ensureInitialized();
      await shutdownServer();

      // Re-initialize
      mockInitWatcher.mockResolvedValue(vi.fn());
      await ensureInitialized();

      expect(mockInitWatcher).toHaveBeenCalledTimes(2);
    });

    it('is safe to call even when not initialized', async () => {
      await expect(shutdownServer()).resolves.not.toThrow();
    });
  });

  // -----------------------------------------------------------------------
  // getInitStatus
  // -----------------------------------------------------------------------
  describe('getInitStatus', () => {
    it('returns not initialized before init', () => {
      const status = getInitStatus();

      expect(status.initialized).toBe(false);
      expect(status.hasCleanup).toBe(false);
    });

    it('returns initialized after successful init', async () => {
      const cleanupMock = vi.fn();
      mockInitWatcher.mockResolvedValue(cleanupMock);
      mockDiscoverAndCacheAll.mockResolvedValue(undefined);

      await ensureInitialized();

      const status = getInitStatus();

      expect(status.initialized).toBe(true);
      expect(status.hasCleanup).toBe(true);
    });

    it('returns not initialized after shutdown', async () => {
      const cleanupMock = vi.fn();
      mockInitWatcher.mockResolvedValue(cleanupMock);
      mockDiscoverAndCacheAll.mockResolvedValue(undefined);

      await ensureInitialized();
      await shutdownServer();

      const status = getInitStatus();

      expect(status.initialized).toBe(false);
      expect(status.hasCleanup).toBe(false);
    });

    it('reports server event listener count', async () => {
      const cleanupMock = vi.fn();
      mockInitWatcher.mockResolvedValue(cleanupMock);
      mockDiscoverAndCacheAll.mockResolvedValue(undefined);

      await ensureInitialized();

      // The init itself registers a listener on watcherEvents, not serverEvents
      // Let's add a listener and check
      serverEvents.on('run-changed', () => {});

      const status = getInitStatus();

      expect(status.serverEventListeners).toBeGreaterThan(0);
    });
  });
});
