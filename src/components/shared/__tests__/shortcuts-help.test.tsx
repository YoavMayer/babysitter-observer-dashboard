import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@/test/test-utils';
import { ShortcutsHelp } from '../shortcuts-help';

describe('ShortcutsHelp', () => {
  it('renders nothing initially (modal is closed)', () => {
    const { container } = render(<ShortcutsHelp />);
    expect(container.firstChild).toBeNull();
  });

  it('opens modal on "?" key press', () => {
    render(<ShortcutsHelp />);
    fireEvent.keyDown(window, { key: '?' });
    expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument();
  });

  it('displays all shortcut descriptions when open', () => {
    render(<ShortcutsHelp />);
    fireEvent.keyDown(window, { key: '?' });

    expect(screen.getByText('Next item')).toBeInTheDocument();
    expect(screen.getByText('Previous item')).toBeInTheDocument();
    expect(screen.getByText('Open selected')).toBeInTheDocument();
    expect(screen.getByText('Go back / Close')).toBeInTheDocument();
    expect(screen.getByText('Toggle event stream')).toBeInTheDocument();
    expect(screen.getByText('Toggle notifications')).toBeInTheDocument();
    expect(screen.getByText('Show this help')).toBeInTheDocument();
    expect(screen.getByText('Focus search')).toBeInTheDocument();
    expect(screen.getByText('Agent tab')).toBeInTheDocument();
    expect(screen.getByText('Timing tab')).toBeInTheDocument();
    expect(screen.getByText('Logs tab')).toBeInTheDocument();
    expect(screen.getByText('Data tab')).toBeInTheDocument();
    expect(screen.getByText('Breakpoint tab')).toBeInTheDocument();
    expect(screen.getByText('Approve breakpoint')).toBeInTheDocument();
    expect(screen.getByText('Reject breakpoint')).toBeInTheDocument();
  });

  it('displays keyboard keys when open', () => {
    render(<ShortcutsHelp />);
    fireEvent.keyDown(window, { key: '?' });

    expect(screen.getByText('j')).toBeInTheDocument();
    expect(screen.getByText('k')).toBeInTheDocument();
    expect(screen.getByText('Enter')).toBeInTheDocument();
    expect(screen.getByText('Esc')).toBeInTheDocument();
  });

  it('closes modal on Escape key press', () => {
    render(<ShortcutsHelp />);
    // Open
    fireEvent.keyDown(window, { key: '?' });
    expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument();
    // Close
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByText('Keyboard Shortcuts')).not.toBeInTheDocument();
  });

  it('closes modal when clicking the close button', async () => {
    render(<ShortcutsHelp />);
    fireEvent.keyDown(window, { key: '?' });
    expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument();

    // Click the close button (the X button)
    const closeButton = screen.getByRole('button');
    fireEvent.click(closeButton);
    expect(screen.queryByText('Keyboard Shortcuts')).not.toBeInTheDocument();
  });

  it('closes modal when clicking the backdrop', () => {
    const { container } = render(<ShortcutsHelp />);
    fireEvent.keyDown(window, { key: '?' });
    expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument();

    // Click the outer overlay div (first child is the fixed inset-0 z-50 wrapper)
    const overlay = container.firstChild as HTMLElement;
    fireEvent.click(overlay);
    expect(screen.queryByText('Keyboard Shortcuts')).not.toBeInTheDocument();
  });
});
