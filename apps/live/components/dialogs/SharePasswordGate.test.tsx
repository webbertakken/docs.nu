// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SharePasswordGate } from './SharePasswordGate';

// The visitor's password gate (docs/specs/013-workspace/share-password.md "Editor flow").

afterEach(() => cleanup());

describe('SharePasswordGate', () => {
  it('says a wrong password did not match', () => {
    render(<SharePasswordGate invalid rateLimited={false} ownerName={null} onSubmit={vi.fn()} />);
    expect(screen.getByText("That password didn't match. Try again.")).toBeTruthy();
  });

  // Over the guess budget the try was not checked, so it is not called wrong: the visitor is told to wait.
  it('asks the visitor to wait after too many tries, never calling the try wrong', () => {
    render(<SharePasswordGate invalid={false} rateLimited ownerName={null} onSubmit={vi.fn()} />);
    const line = screen.getByRole('alert');
    expect(line.textContent).toBe('Too many tries. Wait a minute, then try again.');
    expect(screen.queryByText("That password didn't match. Try again.")).toBeNull();
  });
});
