import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@/test/test-utils';
import userEvent from '@testing-library/user-event';
import { TruncatedId } from '../truncated-id';

// Run ids are ULIDs in practice — opaque machine ids tail-truncate.
const ULID = '01ARZ3NDEKTSV4RRFFQ69G5FAV';

describe('TruncatedId', () => {
  it('renders without crashing', () => {
    render(<TruncatedId id={ULID} />);
    // formatShortId(ULID, 4) => "...5FAV"
    expect(screen.getByText('...5FAV')).toBeInTheDocument();
  });

  it('renders truncated ID with default 4 chars', () => {
    render(<TruncatedId id={ULID} />);
    expect(screen.getByText('...5FAV')).toBeInTheDocument();
  });

  it('renders truncated ID with custom chars count', () => {
    render(<TruncatedId id={ULID} chars={6} />);
    // formatShortId(ULID, 6) => "...9G5FAV"
    expect(screen.getByText('...9G5FAV')).toBeInTheDocument();
  });

  it('renders full ID when shorter than chars', () => {
    render(<TruncatedId id="ab" chars={4} />);
    expect(screen.getByText('ab')).toBeInTheDocument();
  });

  it('renders human-named ids in full instead of tail fragments (QA F9)', () => {
    render(<TruncatedId id="ai-org" />);
    // Not "...-org" — the dir name IS the meaning.
    expect(screen.getByText('ai-org')).toBeInTheDocument();
  });

  it('copies full ID to clipboard on click', async () => {
    const user = userEvent.setup();
    const writeTextSpy = vi.spyOn(navigator.clipboard, 'writeText');
    render(<TruncatedId id={ULID} />);
    const el = screen.getByText('...5FAV');
    await user.click(el);
    expect(writeTextSpy).toHaveBeenCalledWith(ULID);
  });

  it('applies copied class after click', async () => {
    const user = userEvent.setup();
    render(<TruncatedId id={ULID} />);
    const el = screen.getByText('...5FAV');
    await user.click(el);
    // After copying, the element gets 'text-primary' class to indicate copied state
    expect(el.className).toContain('text-primary');
  });

  it('applies custom className', () => {
    const { container } = render(<TruncatedId id="test-id" className="custom-class" />);
    const span = container.querySelector('span');
    expect(span?.className).toContain('custom-class');
  });
});
