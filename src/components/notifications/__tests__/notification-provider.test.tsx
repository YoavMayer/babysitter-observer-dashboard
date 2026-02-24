import { render, screen } from '@/test/test-utils';
import { NotificationProvider, useNotificationContext } from '../notification-provider';
import React from 'react';

// Mock hooks used by NotificationProvider
const mockNotify = vi.fn();
const mockDismiss = vi.fn();
const mockRequestPermission = vi.fn();

vi.mock('@/hooks/use-notifications', () => ({
  useNotifications: () => ({
    notifications: [],
    notify: mockNotify,
    dismiss: mockDismiss,
    requestPermission: mockRequestPermission,
    permission: 'default' as NotificationPermission,
  }),
}));

vi.mock('@/hooks/use-polling', () => ({
  usePolling: () => ({
    data: null,
    loading: false,
    error: null,
    refresh: vi.fn(),
  }),
}));

// Mock ToastStack to avoid next/navigation dependency
vi.mock('../toast-stack', () => ({
  ToastStack: ({ notifications, onDismiss: _onDismiss }: { notifications: unknown[]; onDismiss: (id: string) => void }) =>
    React.createElement('div', { 'data-testid': 'toast-stack' }, `toasts: ${(notifications as unknown[]).length}`),
}));

describe('NotificationProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // Renders children
  // -----------------------------------------------------------------------
  it('renders its children', () => {
    render(
      <NotificationProvider>
        <div data-testid="child">Hello</div>
      </NotificationProvider>,
    );

    expect(screen.getByTestId('child')).toBeInTheDocument();
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // Renders ToastStack
  // -----------------------------------------------------------------------
  it('renders the ToastStack component', () => {
    render(
      <NotificationProvider>
        <span>child</span>
      </NotificationProvider>,
    );

    expect(screen.getByTestId('toast-stack')).toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // Context provides notify function
  // -----------------------------------------------------------------------
  it('provides notify function through context', () => {
    function Consumer() {
      const { notify } = useNotificationContext();
      return (
        <button onClick={() => notify('Test', 'Body', 'info')}>
          Notify
        </button>
      );
    }

    render(
      <NotificationProvider>
        <Consumer />
      </NotificationProvider>,
    );

    screen.getByText('Notify').click();

    expect(mockNotify).toHaveBeenCalledWith('Test', 'Body', 'info');
  });

  // -----------------------------------------------------------------------
  // Context provides dismiss function
  // -----------------------------------------------------------------------
  it('provides dismiss function through context', () => {
    function Consumer() {
      const { dismiss } = useNotificationContext();
      return (
        <button onClick={() => dismiss('notif-1')}>
          Dismiss
        </button>
      );
    }

    render(
      <NotificationProvider>
        <Consumer />
      </NotificationProvider>,
    );

    screen.getByText('Dismiss').click();

    expect(mockDismiss).toHaveBeenCalledWith('notif-1');
  });

  // -----------------------------------------------------------------------
  // Context provides requestPermission
  // -----------------------------------------------------------------------
  it('provides requestPermission through context', () => {
    function Consumer() {
      const { requestPermission } = useNotificationContext();
      return (
        <button onClick={() => requestPermission()}>
          Request
        </button>
      );
    }

    render(
      <NotificationProvider>
        <Consumer />
      </NotificationProvider>,
    );

    screen.getByText('Request').click();

    expect(mockRequestPermission).toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // Context provides permission value
  // -----------------------------------------------------------------------
  it('provides permission value through context', () => {
    function Consumer() {
      const { permission } = useNotificationContext();
      return <span data-testid="perm">{permission}</span>;
    }

    render(
      <NotificationProvider>
        <Consumer />
      </NotificationProvider>,
    );

    expect(screen.getByTestId('perm').textContent).toBe('default');
  });

  // -----------------------------------------------------------------------
  // Context provides notifications array
  // -----------------------------------------------------------------------
  it('provides notifications array through context', () => {
    function Consumer() {
      const { notifications } = useNotificationContext();
      return <span data-testid="count">{notifications.length}</span>;
    }

    render(
      <NotificationProvider>
        <Consumer />
      </NotificationProvider>,
    );

    expect(screen.getByTestId('count').textContent).toBe('0');
  });

  // -----------------------------------------------------------------------
  // Default context values (used without provider)
  // -----------------------------------------------------------------------
  it('provides safe default context values when used without a provider', () => {
    function Consumer() {
      const ctx = useNotificationContext();
      return (
        <div>
          <span data-testid="perm">{ctx.permission}</span>
          <span data-testid="count">{ctx.notifications.length}</span>
          <button onClick={() => ctx.notify('a', 'b')}>n</button>
          <button onClick={() => ctx.dismiss('x')}>d</button>
        </div>
      );
    }

    // Render without provider -- uses the default context
    render(<Consumer />);

    expect(screen.getByTestId('perm').textContent).toBe('default');
    expect(screen.getByTestId('count').textContent).toBe('0');
    // These should not throw
    screen.getByText('n').click();
    screen.getByText('d').click();
  });
});
