import { render, screen, setupUser } from '@/test/test-utils';
import { BreakpointPanel } from '../breakpoint-panel';
import { createMockTaskDetail } from '@/test/fixtures';
import type { TaskDetail } from '@/types';

// Mock the breakpoint resolve hook
const mockResolve = vi.fn();
let mockLoading = false;
let mockError: string | null = null;
let mockResolved = false;

vi.mock('@/hooks/use-breakpoint-resolve', () => ({
  useBreakpointResolve: () => ({
    resolve: mockResolve,
    loading: mockLoading,
    error: mockError,
    resolved: mockResolved,
    clearError: vi.fn(),
  }),
}));

describe('BreakpointPanel', () => {
  const defaultRunId = 'run-123';

  function makeBreakpointTask(overrides: Partial<TaskDetail> = {}): TaskDetail {
    return createMockTaskDetail({
      kind: 'breakpoint',
      status: 'requested',
      breakpointQuestion: 'Should we deploy to production?',
      title: 'Deploy Approval',
      breakpoint: {
        question: 'Should we deploy to production?',
        title: 'Deploy Approval',
        context: { files: [] },
      },
      ...overrides,
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockLoading = false;
    mockError = null;
    mockResolved = false;
    mockResolve.mockResolvedValue({ success: true });
  });

  // -----------------------------------------------------------------------
  // Rendering
  // -----------------------------------------------------------------------
  it('renders the breakpoint title', () => {
    const task = makeBreakpointTask();
    render(<BreakpointPanel task={task} runId={defaultRunId} />);

    expect(screen.getByText('Deploy Approval')).toBeInTheDocument();
  });

  it('renders the breakpoint question', () => {
    const task = makeBreakpointTask();
    render(<BreakpointPanel task={task} runId={defaultRunId} />);

    expect(screen.getByText('Should we deploy to production?')).toBeInTheDocument();
  });

  it('renders the "Breakpoint" badge', () => {
    const task = makeBreakpointTask();
    render(<BreakpointPanel task={task} runId={defaultRunId} />);

    expect(screen.getByText('Breakpoint')).toBeInTheDocument();
  });

  it('renders the "Awaiting decision" label', () => {
    const task = makeBreakpointTask();
    render(<BreakpointPanel task={task} runId={defaultRunId} />);

    expect(screen.getByText('Awaiting decision')).toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // Approve / Reject buttons
  // -----------------------------------------------------------------------
  it('renders Approve and Reject buttons when task is waiting', () => {
    const task = makeBreakpointTask({ status: 'requested' });
    render(<BreakpointPanel task={task} runId={defaultRunId} />);

    expect(screen.getByText('Approve')).toBeInTheDocument();
    expect(screen.getByText('Reject')).toBeInTheDocument();
  });

  it('shows confirmation on first click, then executes on second click (approve)', async () => {
    const user = setupUser();
    const task = makeBreakpointTask({ status: 'requested' });
    render(<BreakpointPanel task={task} runId={defaultRunId} />);

    // First click: shows confirmation
    await user.click(screen.getByText('Approve'));
    expect(screen.getByText('Confirm?')).toBeInTheDocument();
    expect(mockResolve).not.toHaveBeenCalled();

    // Second click: executes
    await user.click(screen.getByText('Confirm?'));
    expect(mockResolve).toHaveBeenCalledWith(defaultRunId, task.effectId, true);
  });

  it('shows confirmation on first click, then executes on second click (reject)', async () => {
    const user = setupUser();
    const task = makeBreakpointTask({ status: 'requested' });
    render(<BreakpointPanel task={task} runId={defaultRunId} />);

    // First click: shows confirmation
    await user.click(screen.getByText('Reject'));
    // Now both buttons render; the reject one should show "Confirm?"
    const confirmButtons = screen.getAllByText('Confirm?');
    expect(confirmButtons.length).toBeGreaterThanOrEqual(1);
    expect(mockResolve).not.toHaveBeenCalled();

    // Second click: executes
    await user.click(confirmButtons[confirmButtons.length - 1]);
    expect(mockResolve).toHaveBeenCalledWith(defaultRunId, task.effectId, false);
  });

  it('does not show buttons when task is already resolved', () => {
    const task = makeBreakpointTask({ status: 'resolved' });
    render(<BreakpointPanel task={task} runId={defaultRunId} />);

    expect(screen.queryByText('Approve')).not.toBeInTheDocument();
    expect(screen.queryByText('Reject')).not.toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // Loading state
  // -----------------------------------------------------------------------
  it('disables buttons during loading', () => {
    mockLoading = true;
    const task = makeBreakpointTask({ status: 'requested' });
    render(<BreakpointPanel task={task} runId={defaultRunId} />);

    const buttons = screen.getAllByRole('button');
    // Approve and Reject buttons should be disabled
    const approveBtn = buttons.find((b) => b.textContent?.includes('Approve'));
    const rejectBtn = buttons.find((b) => b.textContent?.includes('Reject'));

    expect(approveBtn).toBeDisabled();
    expect(rejectBtn).toBeDisabled();
  });

  // -----------------------------------------------------------------------
  // Already resolved state (task.status === 'resolved')
  // -----------------------------------------------------------------------
  it('shows "Already Resolved" badge when task.status is resolved and hook has not resolved', () => {
    mockResolved = false;
    const task = makeBreakpointTask({ status: 'resolved' });
    render(<BreakpointPanel task={task} runId={defaultRunId} />);

    expect(screen.getByText('Already Resolved')).toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // Resolved state (via hook)
  // -----------------------------------------------------------------------
  it('shows "Resolved" badge when hook indicates resolved', () => {
    mockResolved = true;
    const task = makeBreakpointTask({ status: 'requested' });
    render(<BreakpointPanel task={task} runId={defaultRunId} />);

    expect(screen.getByText('Resolved')).toBeInTheDocument();
  });

  it('shows success message when resolved', () => {
    mockResolved = true;
    const task = makeBreakpointTask({ status: 'requested' });
    render(<BreakpointPanel task={task} runId={defaultRunId} />);

    expect(screen.getByText('Approved')).toBeInTheDocument();
    expect(screen.getByText('Breakpoint has been resolved')).toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // Error state
  // -----------------------------------------------------------------------
  it('displays error message when hook has an error', () => {
    mockError = 'Failed to resolve breakpoint';
    const task = makeBreakpointTask({ status: 'requested' });
    render(<BreakpointPanel task={task} runId={defaultRunId} />);

    expect(screen.getByText('Failed to resolve breakpoint')).toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // Callback
  // -----------------------------------------------------------------------
  it('calls onResolved callback after successful resolution', async () => {
    const user = setupUser();
    const onResolved = vi.fn();
    const task = makeBreakpointTask({ status: 'requested' });

    render(
      <BreakpointPanel task={task} runId={defaultRunId} onResolved={onResolved} />,
    );

    // Click Approve twice (confirm pattern)
    await user.click(screen.getByText('Approve'));
    await user.click(screen.getByText('Confirm?'));

    expect(onResolved).toHaveBeenCalledWith(true);
  });

  // -----------------------------------------------------------------------
  // Fallback question text
  // -----------------------------------------------------------------------
  it('falls back to breakpointQuestion when breakpoint payload is missing', () => {
    const task = createMockTaskDetail({
      kind: 'breakpoint',
      status: 'requested',
      breakpointQuestion: 'Fallback question?',
      title: 'Fallback Title',
      breakpoint: undefined,
    });

    render(<BreakpointPanel task={task} runId={defaultRunId} />);

    expect(screen.getByText('Fallback question?')).toBeInTheDocument();
  });

  it('falls back to "Approval required" when no question is provided', () => {
    const task = createMockTaskDetail({
      kind: 'breakpoint',
      status: 'requested',
      breakpointQuestion: undefined,
      breakpoint: undefined,
    });

    render(<BreakpointPanel task={task} runId={defaultRunId} />);

    expect(screen.getByText('Approval required')).toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // Keyboard shortcut hint text
  // -----------------------------------------------------------------------
  it('shows keyboard shortcut hint text', () => {
    const task = makeBreakpointTask({ status: 'requested' });
    render(<BreakpointPanel task={task} runId={defaultRunId} />);

    expect(screen.getByText(/Press a\/r or click, then confirm/)).toBeInTheDocument();
  });
});
