import { render, screen } from '@/test/test-utils';
import { vi } from 'vitest';
import { RunList } from '../run-list';
import { createMockRun, resetIdCounter } from '@/test/fixtures';
import type { LightRun, RunsListResponse } from '@/lib/services/run-query-service';

// Mock the polling hook so we can drive the component with static data.
const mockUseSmartPolling = vi.fn();
vi.mock('@/hooks/use-smart-polling', () => ({
  useSmartPolling: (...args: unknown[]) => mockUseSmartPolling(...args),
}));

// Mock next/link
vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href} data-testid="next-link">
      {children}
    </a>
  ),
}));

beforeEach(() => {
  resetIdCounter();
  vi.clearAllMocks();
});

/** Build a LightRun from the shared Run fixture (events stripped). */
function lightRun(overrides: Parameters<typeof createMockRun>[0] = {}): LightRun {
  const run = createMockRun(overrides);
  return { ...run, events: [], totalEvents: 0 } as LightRun;
}

function setupPolling(
  data: RunsListResponse | null,
  { loading = false, error = null }: { loading?: boolean; error?: string | null } = {}
) {
  mockUseSmartPolling.mockReturnValue({ data, loading, error, refresh: vi.fn() });
}

describe('RunList (flat filtered list)', () => {
  it('renders an empty state when there are no runs', () => {
    setupPolling({ runs: [], totalCount: 0 });
    render(<RunList status="waiting" />);
    expect(screen.getByText('No runs found')).toBeInTheDocument();
  });

  it('renders one row per run with process label and short id', () => {
    const runs = [
      lightRun({ runId: 'aaaaaaaa-1', processId: 'process-alpha' }),
      lightRun({ runId: 'bbbbbbbb-2', processId: 'process-beta' }),
    ];
    setupPolling({ runs, totalCount: 2 });
    render(<RunList status="waiting" />);

    expect(screen.getAllByTestId('next-link')).toHaveLength(2);
    expect(screen.getByText('Process Alpha')).toBeInTheDocument();
    expect(screen.getByText('Process Beta')).toBeInTheDocument();
    expect(screen.getByText('aaaaaaaa')).toBeInTheDocument();
  });

  it('shows the resume hint for an orphaned breakpoint run', () => {
    const runs = [
      lightRun({
        runId: 'orphan-1',
        status: 'waiting',
        waitingKind: 'breakpoint',
        driver: 'orphaned',
      }),
    ];
    setupPolling({ runs, totalCount: 1 });
    render(<RunList status="orphaned" />);

    expect(screen.getByText('No live driver — resume to answer')).toBeInTheDocument();
  });

  it('shows no orphaned chip or resume hint for a terminal run', () => {
    // A completed run reports no attached orchestrator (driver: 'orphaned'),
    // but liveness is meaningless for terminal runs — no alarm should show.
    const runs = [
      lightRun({
        runId: 'done-1',
        status: 'completed',
        driver: 'orphaned',
      }),
    ];
    setupPolling({ runs, totalCount: 1 });
    render(<RunList status="completed" />);

    expect(screen.queryByText('orphaned')).not.toBeInTheDocument();
    expect(
      screen.queryByText('No live driver — resume to answer')
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId('run-action-hint')).not.toBeInTheDocument();
    // A neutral, status-appropriate label is shown instead.
    expect(screen.getByText('completed')).toBeInTheDocument();
  });

  it('shows the orphaned chip and resume hint for a waiting orphaned run', () => {
    const runs = [
      lightRun({
        runId: 'orphan-2',
        status: 'waiting',
        waitingKind: 'breakpoint',
        driver: 'orphaned',
      }),
    ];
    setupPolling({ runs, totalCount: 1 });
    render(<RunList status="orphaned" />);

    expect(screen.getByText('orphaned')).toBeInTheDocument();
    expect(
      screen.getByText('No live driver — resume to answer')
    ).toBeInTheDocument();
  });

  it('shows the terminal hint for a live breakpoint run', () => {
    const runs = [
      lightRun({
        runId: 'live-1',
        status: 'waiting',
        waitingKind: 'breakpoint',
        driver: 'live',
      }),
    ];
    setupPolling({ runs, totalCount: 1 });
    render(<RunList status="needsyou" />);

    expect(screen.getByText('Answer in terminal')).toBeInTheDocument();
  });

  it('shows "Load more" when fetched runs are fewer than totalCount', () => {
    const runs = [lightRun({ runId: 'r-1' }), lightRun({ runId: 'r-2' })];
    setupPolling({ runs, totalCount: 10 });
    render(<RunList status="completed" />);

    expect(screen.getByText(/Load more \(8 remaining\)/)).toBeInTheDocument();
  });

  it('does not show "Load more" when all runs are loaded', () => {
    const runs = [lightRun({ runId: 'r-1' }), lightRun({ runId: 'r-2' })];
    setupPolling({ runs, totalCount: 2 });
    render(<RunList status="completed" />);

    expect(screen.queryByText(/Load more/)).not.toBeInTheDocument();
  });

  it('renders an error state when the fetch fails', () => {
    setupPolling(null, { error: 'boom' });
    render(<RunList status="failed" />);
    expect(screen.getByTestId('run-list-error')).toBeInTheDocument();
  });
});
