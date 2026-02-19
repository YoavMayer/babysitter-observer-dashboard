import { render, screen, setupUser } from '@/test/test-utils';
import { BreakpointPanel } from '../breakpoint-panel';
import { createMockTaskDetail } from '@/test/fixtures';
import type { TaskDetail } from '@/types';

// ---------------------------------------------------------------------------
// Mock useBreakpointResolve
// ---------------------------------------------------------------------------
const mockResolve = vi.fn();
const mockClearError = vi.fn();
let mockHookReturn = {
  resolve: mockResolve,
  loading: false,
  error: null as string | null,
  resolved: false,
  clearError: mockClearError,
};

vi.mock('@/hooks/use-breakpoint-resolve', () => ({
  useBreakpointResolve: () => mockHookReturn,
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
    mockHookReturn = {
      resolve: mockResolve,
      loading: false,
      error: null,
      resolved: false,
      clearError: mockClearError,
    };
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

  it('renders the "Approval Required" badge', () => {
    const task = makeBreakpointTask();
    render(<BreakpointPanel task={task} runId={defaultRunId} />);

    expect(screen.getByText('Approval Required')).toBeInTheDocument();
  });

  it('renders the "Your approval is needed" label', () => {
    const task = makeBreakpointTask();
    render(<BreakpointPanel task={task} runId={defaultRunId} />);

    expect(screen.getByText('Your approval is needed')).toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // Approve/Reject buttons render when status is 'requested' (waiting)
  // -----------------------------------------------------------------------
  it('renders Approve and Reject buttons when status is requested', () => {
    const task = makeBreakpointTask({ status: 'requested' });
    render(<BreakpointPanel task={task} runId={defaultRunId} />);

    expect(screen.getByRole('button', { name: /Approve/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reject/i })).toBeInTheDocument();
  });

  it('renders the comment textarea when status is requested', () => {
    const task = makeBreakpointTask({ status: 'requested' });
    render(<BreakpointPanel task={task} runId={defaultRunId} />);

    expect(screen.getByLabelText(/Comment/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Add a comment/i)).toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // Buttons do NOT render when status is not 'requested'
  // -----------------------------------------------------------------------
  it('does not render Approve or Reject buttons when status is resolved', () => {
    const task = makeBreakpointTask({ status: 'resolved' });
    render(<BreakpointPanel task={task} runId={defaultRunId} />);

    expect(screen.queryByRole('button', { name: /Approve/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Reject/i })).not.toBeInTheDocument();
  });

  it('does not render Approve or Reject buttons when status is error', () => {
    const task = makeBreakpointTask({ status: 'error' });
    render(<BreakpointPanel task={task} runId={defaultRunId} />);

    expect(screen.queryByRole('button', { name: /Approve/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Reject/i })).not.toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // Confirmation flow — Approve
  // -----------------------------------------------------------------------
  it('shows confirmation text on first Approve click without calling resolve', async () => {
    const user = setupUser();
    const task = makeBreakpointTask({ status: 'requested' });
    render(<BreakpointPanel task={task} runId={defaultRunId} />);

    await user.click(screen.getByRole('button', { name: /^Approve$/i }));

    expect(screen.getByText('Click Approve again to confirm')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Confirm Approve/i })).toBeInTheDocument();
    expect(mockResolve).not.toHaveBeenCalled();
  });

  it('calls resolve with approved=true on second Approve click', async () => {
    const user = setupUser();
    const task = makeBreakpointTask({ status: 'requested' });
    render(<BreakpointPanel task={task} runId={defaultRunId} />);

    // First click — enter confirmation
    await user.click(screen.getByRole('button', { name: /^Approve$/i }));
    // Second click — confirm
    await user.click(screen.getByRole('button', { name: /Confirm Approve/i }));

    expect(mockResolve).toHaveBeenCalledWith(defaultRunId, task.effectId, true, undefined);
  });

  it('includes comment in resolve call when provided', async () => {
    const user = setupUser();
    const task = makeBreakpointTask({ status: 'requested' });
    render(<BreakpointPanel task={task} runId={defaultRunId} />);

    // Type a comment
    await user.type(screen.getByPlaceholderText(/Add a comment/i), 'Looks good to me');

    // First click — enter confirmation
    await user.click(screen.getByRole('button', { name: /^Approve$/i }));
    // Second click — confirm
    await user.click(screen.getByRole('button', { name: /Confirm Approve/i }));

    expect(mockResolve).toHaveBeenCalledWith(defaultRunId, task.effectId, true, 'Looks good to me');
  });

  // -----------------------------------------------------------------------
  // Confirmation flow — Reject
  // -----------------------------------------------------------------------
  it('shows confirmation text on first Reject click without calling resolve', async () => {
    const user = setupUser();
    const task = makeBreakpointTask({ status: 'requested' });
    render(<BreakpointPanel task={task} runId={defaultRunId} />);

    await user.click(screen.getByRole('button', { name: /^Reject$/i }));

    expect(screen.getByText('Click Reject again to confirm')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Confirm Reject/i })).toBeInTheDocument();
    expect(mockResolve).not.toHaveBeenCalled();
  });

  it('calls resolve with approved=false on second Reject click', async () => {
    const user = setupUser();
    const task = makeBreakpointTask({ status: 'requested' });
    render(<BreakpointPanel task={task} runId={defaultRunId} />);

    // First click — enter confirmation
    await user.click(screen.getByRole('button', { name: /^Reject$/i }));
    // Second click — confirm
    await user.click(screen.getByRole('button', { name: /Confirm Reject/i }));

    expect(mockResolve).toHaveBeenCalledWith(defaultRunId, task.effectId, false, undefined);
  });

  // -----------------------------------------------------------------------
  // Cancel confirmation
  // -----------------------------------------------------------------------
  it('cancels confirmation when Cancel is clicked', async () => {
    const user = setupUser();
    const task = makeBreakpointTask({ status: 'requested' });
    render(<BreakpointPanel task={task} runId={defaultRunId} />);

    // Enter confirmation for approve
    await user.click(screen.getByRole('button', { name: /^Approve$/i }));
    expect(screen.getByText('Click Approve again to confirm')).toBeInTheDocument();

    // Click cancel
    await user.click(screen.getByText('Cancel'));

    // Confirmation should be gone, buttons back to normal
    expect(screen.queryByText('Click Approve again to confirm')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Approve$/i })).toBeInTheDocument();
    expect(mockResolve).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // Loading state
  // -----------------------------------------------------------------------
  it('disables both buttons when loading', () => {
    mockHookReturn = { ...mockHookReturn, loading: true };
    const task = makeBreakpointTask({ status: 'requested' });
    render(<BreakpointPanel task={task} runId={defaultRunId} />);

    const approveBtn = screen.getByRole('button', { name: /Approve/i });
    const rejectBtn = screen.getByRole('button', { name: /Reject/i });

    expect(approveBtn).toBeDisabled();
    expect(rejectBtn).toBeDisabled();
  });

  it('shows loading spinner icon when loading', () => {
    mockHookReturn = { ...mockHookReturn, loading: true };
    const task = makeBreakpointTask({ status: 'requested' });
    render(<BreakpointPanel task={task} runId={defaultRunId} />);

    // Loader2 icons render as svg with data-testid="icon-Loader2"
    const loaders = screen.getAllByTestId('icon-Loader2');
    expect(loaders.length).toBeGreaterThanOrEqual(1);
  });

  // -----------------------------------------------------------------------
  // Error state
  // -----------------------------------------------------------------------
  it('displays error message when hook returns an error', () => {
    mockHookReturn = { ...mockHookReturn, error: 'Network failure' };
    const task = makeBreakpointTask({ status: 'requested' });
    render(<BreakpointPanel task={task} runId={defaultRunId} />);

    expect(screen.getByText('Network failure')).toBeInTheDocument();
    expect(screen.getByTestId('icon-AlertCircle')).toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // Success state (resolved via hook)
  // -----------------------------------------------------------------------
  it('shows success message when hook reports resolved', () => {
    mockHookReturn = { ...mockHookReturn, resolved: true };
    const task = makeBreakpointTask({ status: 'requested' });
    render(<BreakpointPanel task={task} runId={defaultRunId} />);

    expect(screen.getByText('Decision submitted')).toBeInTheDocument();
    expect(screen.getByText('Your approval has been submitted successfully')).toBeInTheDocument();
  });

  it('hides Approve and Reject buttons when hook reports resolved', () => {
    mockHookReturn = { ...mockHookReturn, resolved: true };
    const task = makeBreakpointTask({ status: 'requested' });
    render(<BreakpointPanel task={task} runId={defaultRunId} />);

    expect(screen.queryByRole('button', { name: /Approve/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Reject/i })).not.toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // Already resolved state (task.status === 'resolved')
  // -----------------------------------------------------------------------
  it('shows "Already Resolved" badge when task.status is resolved', () => {
    const task = makeBreakpointTask({ status: 'resolved' });
    render(<BreakpointPanel task={task} runId={defaultRunId} />);

    expect(screen.getByText('Already Resolved')).toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // Resolved state display
  // -----------------------------------------------------------------------
  it('shows success message when task is resolved', () => {
    const task = makeBreakpointTask({ status: 'resolved' });
    render(<BreakpointPanel task={task} runId={defaultRunId} />);

    expect(screen.getByText('Approved')).toBeInTheDocument();
    expect(screen.getByText('Approval has been resolved')).toBeInTheDocument();
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
  // Mutual exclusion: selecting one action disables the other
  // -----------------------------------------------------------------------
  it('disables Reject button when Approve is in confirmation mode', async () => {
    const user = setupUser();
    const task = makeBreakpointTask({ status: 'requested' });
    render(<BreakpointPanel task={task} runId={defaultRunId} />);

    await user.click(screen.getByRole('button', { name: /^Approve$/i }));

    expect(screen.getByRole('button', { name: /Reject/i })).toBeDisabled();
  });

  it('disables Approve button when Reject is in confirmation mode', async () => {
    const user = setupUser();
    const task = makeBreakpointTask({ status: 'requested' });
    render(<BreakpointPanel task={task} runId={defaultRunId} />);

    await user.click(screen.getByRole('button', { name: /^Reject$/i }));

    expect(screen.getByRole('button', { name: /Approve/i })).toBeDisabled();
  });

  // -----------------------------------------------------------------------
  // Comment textarea disabled during loading
  // -----------------------------------------------------------------------
  it('disables the comment textarea when loading', () => {
    mockHookReturn = { ...mockHookReturn, loading: true };
    const task = makeBreakpointTask({ status: 'requested' });
    render(<BreakpointPanel task={task} runId={defaultRunId} />);

    expect(screen.getByPlaceholderText(/Add a comment/i)).toBeDisabled();
  });
});
