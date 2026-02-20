import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@/test/test-utils';
import userEvent from '@testing-library/user-event';
import { SettingsModal } from '../settings-modal';
import { ThemeProvider } from '../theme-provider';

const mockConfig = {
  sources: [{ path: '/tmp/runs', depth: 2, label: 'test' }],
  port: 4040,
  pollInterval: 2000,
  theme: 'dark' as const,
  retentionDays: 30,
  hiddenProjects: [],
};

const mockProjects = {
  projects: [{ projectName: 'test-project' }],
};

/** Helper: mock globalThis.fetch so every call returns fresh Response objects. */
function mockFetchSuccess(configData = mockConfig, projectsData = mockProjects) {
  let callIndex = 0;
  vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
    const idx = callIndex++;
    if (idx === 0) {
      // First call: /api/config
      return Promise.resolve(
        new Response(JSON.stringify(configData), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    }
    // Second call: /api/runs?mode=projects
    return Promise.resolve(
      new Response(JSON.stringify(projectsData), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  });
}

function renderWithTheme(open: boolean, onClose = vi.fn()) {
  return render(
    <ThemeProvider>
      <SettingsModal open={open} onClose={onClose} />
    </ThemeProvider>,
  );
}

describe('SettingsModal', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders nothing when open is false', () => {
    const { container } = renderWithTheme(false);
    expect(container.querySelector('[class*="fixed"]')).toBeNull();
  });

  it('renders modal when open is true and config loads', async () => {
    mockFetchSuccess();

    renderWithTheme(true);

    await waitFor(() => {
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });
  });

  it('shows loading indicator while fetching config', () => {
    // Never resolve fetch
    vi.spyOn(globalThis, 'fetch').mockReturnValueOnce(new Promise(() => {}));

    renderWithTheme(true);

    expect(screen.getByText('Loading configuration...')).toBeInTheDocument();
  });

  it('shows fetch error when config load fails', async () => {
    let callIndex = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
      const idx = callIndex++;
      if (idx === 0) {
        // First call: /api/config — non-retryable 422 error
        return Promise.resolve(
          new Response('Bad request', {
            status: 422,
            headers: { 'Content-Type': 'text/plain' },
          }),
        );
      }
      // Second call: /api/runs?mode=projects — also fail
      return Promise.resolve(
        new Response('Bad request', {
          status: 422,
          headers: { 'Content-Type': 'text/plain' },
        }),
      );
    });

    renderWithTheme(true);

    await waitFor(() => {
      expect(screen.getByText(/Failed to load config/)).toBeInTheDocument();
    });
  });

  it('displays watch sources section after config loads', async () => {
    mockFetchSuccess();

    renderWithTheme(true);

    await waitFor(() => {
      expect(screen.getByText('Watch Sources')).toBeInTheDocument();
    });
  });

  it('displays poll interval section after config loads', async () => {
    mockFetchSuccess();

    renderWithTheme(true);

    await waitFor(() => {
      expect(screen.getByText('Poll Interval')).toBeInTheDocument();
    });
  });

  it('displays theme section after config loads', async () => {
    mockFetchSuccess();

    renderWithTheme(true);

    await waitFor(() => {
      expect(screen.getByText('Theme')).toBeInTheDocument();
    });
  });

  it('calls onClose when clicking the close button', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    mockFetchSuccess();

    render(
      <ThemeProvider>
        <SettingsModal open={true} onClose={onClose} />
      </ThemeProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });

    // Click the X close button (the button adjacent to the header)
    const closeButtons = screen.getAllByRole('button');
    // First button should be the X close button
    const xButton = closeButtons[0];
    await user.click(xButton);
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when pressing Escape', async () => {
    const onClose = vi.fn();
    mockFetchSuccess();

    render(
      <ThemeProvider>
        <SettingsModal open={true} onClose={onClose} />
      </ThemeProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });

    // Fire Escape keydown on window
    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
    window.dispatchEvent(event);

    expect(onClose).toHaveBeenCalled();
  });

  it('shows Add Source button and can add a new source', async () => {
    const user = userEvent.setup();
    mockFetchSuccess();

    renderWithTheme(true);

    await waitFor(() => {
      expect(screen.getByText('Add Source')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Source'));

    // There should now be 2 source path inputs (original + new)
    const pathInputs = screen.getAllByPlaceholderText('/path/to/projects');
    expect(pathInputs.length).toBe(2);
  });

  it('shows config file path in footer', async () => {
    mockFetchSuccess();

    renderWithTheme(true);

    await waitFor(() => {
      expect(screen.getByText('~/.a5c/observer.json')).toBeInTheDocument();
    });
  });
});
