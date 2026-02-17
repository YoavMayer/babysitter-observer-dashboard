import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';
import React from 'react';

// Mock lucide-react to avoid React version mismatch in monorepo
// (observer has React 18 locally, root has React 19)
vi.mock('lucide-react', () => {
  const createIconMock = (name: string) => {
    const Icon = React.forwardRef<SVGSVGElement, any>(
      function IconMock(props: any, ref: any) {
        return React.createElement('svg', {
          ...props,
          ref,
          'data-testid': `icon-${name}`,
          'data-lucide': name,
        });
      },
    );
    Icon.displayName = name;
    return Icon;
  };

  // All icon names used in shared + ui components
  const iconNames = [
    'Bot', 'Check', 'CheckCircle2', 'ChevronDown', 'ChevronRight', 'ChevronUp',
    'Circle', 'Clock', 'Cog', 'FolderOpen', 'Hand', 'Inbox', 'Info',
    'Loader2', 'Palette', 'Pause', 'Percent', 'Plus', 'Puzzle', 'RefreshCw',
    'Settings', 'Terminal', 'Timer', 'Trash2', 'X', 'XCircle',
    // Additional icons that might be used transitively
    'AlertCircle', 'AlertTriangle', 'Bell', 'ChevronLeft', 'Code', 'Copy', 'FileJson',
    'FileText', 'GitBranch', 'Layers', 'Search', 'Tag',
  ];

  const mocks: Record<string, any> = {};
  for (const name of iconNames) {
    mocks[name] = createIconMock(name);
  }
  return mocks;
});

// Extend vitest's expect with jest-dom matchers
expect.extend(matchers);

// Clean up after each test
afterEach(() => {
  cleanup();
});

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

// Mock IntersectionObserver
class MockIntersectionObserver implements IntersectionObserver {
  readonly root: Element | null = null;
  readonly rootMargin: string = '';
  readonly thresholds: ReadonlyArray<number> = [];

  constructor(
    private callback: IntersectionObserverCallback,
    _options?: IntersectionObserverInit,
  ) {}

  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

Object.defineProperty(window, 'IntersectionObserver', {
  writable: true,
  value: MockIntersectionObserver,
});

// Mock navigator.clipboard (configurable so userEvent can re-stub it)
Object.defineProperty(navigator, 'clipboard', {
  writable: true,
  configurable: true,
  value: {
    writeText: async (_text: string) => {},
    readText: async () => '',
    write: async () => {},
    read: async () => [],
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  },
});

// Mock ResizeObserver (used by Radix UI components)
class MockResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

Object.defineProperty(window, 'ResizeObserver', {
  writable: true,
  value: MockResizeObserver,
});
