// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CreateFailure } from '@/lib/new-document/create-failure';
import { NotSavedNotice } from './NotSavedBanner';

const failure = (action: CreateFailure['action']): CreateFailure => ({
  action,
  eyebrow: 'x',
  title: 'x',
  message:
    action === 'choose'
      ? 'That folder no longer exists, or isn’t yours.'
      : 'Check your connection.',
  actionLabel: 'x',
});

const view = (f: CreateFailure | null) => ({
  held: true,
  failure: f,
  retry: vi.fn(),
  saveToMyDocuments: vi.fn(),
});

describe('NotSavedNotice', () => {
  it('says nothing while the create is running or has landed', () => {
    const { container } = render(<NotSavedNotice pending={view(null)} />);
    expect(container.innerHTML).toBe('');
  });

  it('offers Try again for a failure that can clear', () => {
    const pending = view(failure('retry'));
    render(<NotSavedNotice pending={pending} />);
    expect(screen.getByRole('alert').textContent).toBe('Not saved yet. Check your connection.');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(pending.retry).toHaveBeenCalledOnce();
  });

  it('offers Save to My Documents for a refused placement', () => {
    const pending = view(failure('choose'));
    render(<NotSavedNotice pending={pending} />);
    fireEvent.click(screen.getByRole('button', { name: 'Save to My Documents' }));
    expect(pending.saveToMyDocuments).toHaveBeenCalledOnce();
    expect(pending.retry).not.toHaveBeenCalled();
  });
});
