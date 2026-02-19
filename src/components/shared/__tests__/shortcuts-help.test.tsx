import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@/test/test-utils';
import { ShortcutsHelp } from '../shortcuts-help';

describe('ShortcutsHelp', () => {
  it('renders nothing initially (modal is closed)', () => {
    render(<ShortcutsHelp />);
    expect(screen.queryByText('Keyboard Shortcuts')).not.toBeInTheDocument();
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
    expect(screen.getByText('Approval tab')).toBeInTheDocument();
    expect(screen.getByText('Approve request')).toBeInTheDocument();
    expect(screen.getByText('Reject request')).toBeInTheDocument();
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

    // Click the close button (the X button) - find it via the Dialog.Close wrapping
    const closeButton = screen.getByTestId('icon-X').closest('button')!;
    fireEvent.click(closeButton);
    expect(screen.queryByText('Keyboard Shortcuts')).not.toBeInTheDocument();
  });
});
