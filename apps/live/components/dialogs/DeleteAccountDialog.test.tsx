// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// docs/specs/014-identity/auth-and-guest-access.md "Deleting an account": one request deletes the data, then the
// identity; a session verified too long ago is asked for a code first, and a refused or failed verification deletes
// nothing.
const calls: string[] = [];
const outcomes = vi.hoisted(() => ({ queue: [] as string[] }));
vi.mock('@/components/providers/deferred-auth', () => ({
  useDeferredAuth: () => ({
    user: { email: 'a@example.com' },
    deleteAccount: async () => {
      calls.push('delete');
      return outcomes.queue.shift() ?? 'failed';
    },
  }),
}));
const reverify = vi.hoisted(() => ({
  sendReverifyCode: vi.fn(async (_email: string) => null as string | null),
  reverifyWithCode: vi.fn(async (_email: string, _otp: string) => null as string | null),
}));
vi.mock('@/lib/reverify', () => reverify);
const telemetry = vi.hoisted(() => ({ track: vi.fn() }));
vi.mock('@/lib/telemetry', () => telemetry);

import { DeleteAccountDialog } from './DeleteAccountDialog';

beforeEach(() => {
  reverify.sendReverifyCode.mockClear();
  reverify.reverifyWithCode.mockClear();
  telemetry.track.mockClear();
});

afterEach(() => {
  cleanup();
  calls.length = 0;
  outcomes.queue = [];
});

function confirmDelete() {
  const onDeleted = vi.fn();
  render(<DeleteAccountDialog open onClose={() => {}} onDeleted={onDeleted} />);
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'a@example.com' } });
  fireEvent.click(screen.getByRole('button', { name: 'Delete Account' }));
  return onDeleted;
}

describe('DeleteAccountDialog', () => {
  it('deletes the account and signs out when the session is fresh', async () => {
    outcomes.queue = ['deleted'];
    const onDeleted = confirmDelete();
    await waitFor(() => expect(onDeleted).toHaveBeenCalled());
    expect(calls).toEqual(['delete']);
    expect(telemetry.track).toHaveBeenCalledWith('Session', 'Deleted', 'Account');
    expect(reverify.sendReverifyCode).not.toHaveBeenCalled();
  });

  it('asks for a code when the session is too old, then deletes', async () => {
    outcomes.queue = ['not-fresh', 'deleted'];
    const onDeleted = confirmDelete();
    const field = await screen.findByLabelText('6-digit code');
    expect(reverify.sendReverifyCode).toHaveBeenCalledWith('a@example.com');
    fireEvent.change(field, { target: { value: '123456' } });
    await waitFor(() => expect(onDeleted).toHaveBeenCalled());
    expect(reverify.reverifyWithCode).toHaveBeenCalledWith('a@example.com', '123456');
    expect(calls).toEqual(['delete', 'delete']);
  });

  it('deletes nothing when the code is refused', async () => {
    outcomes.queue = ['not-fresh'];
    reverify.reverifyWithCode.mockResolvedValueOnce("That code isn't right.");
    const onDeleted = confirmDelete();
    fireEvent.change(await screen.findByLabelText('6-digit code'), { target: { value: '000000' } });
    await screen.findByText(/That code isn't right\. Nothing was deleted\./);
    expect(calls).toEqual(['delete']);
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it('deletes nothing when the code cannot be sent', async () => {
    outcomes.queue = ['not-fresh'];
    reverify.sendReverifyCode.mockResolvedValueOnce("We couldn't send the code.");
    const onDeleted = confirmDelete();
    await screen.findByText(/We couldn't send the code\. Nothing was deleted\./);
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it('says so when the deletion failed', async () => {
    outcomes.queue = ['failed'];
    const onDeleted = confirmDelete();
    await screen.findByText("We couldn't delete your account. Try again.");
    expect(onDeleted).not.toHaveBeenCalled();
  });
});
