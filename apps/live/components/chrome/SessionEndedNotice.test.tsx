// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({ value: { sessionEnded: false } as { sessionEnded?: boolean } }));
vi.mock('@/components/providers/deferred-auth', () => ({ useDeferredAuth: () => auth.value }));
const toast = vi.hoisted(() => ({ warning: vi.fn() }));
vi.mock('@/hooks/ui/useToast', () => ({ useToast: () => toast }));

import { SESSION_ENDED_MESSAGE, SessionEndedNotice } from './SessionEndedNotice';

afterEach(() => {
  cleanup();
  toast.warning.mockReset();
});

describe('SessionEndedNotice', () => {
  it('says nothing while the session holds, or after this page signed out', () => {
    auth.value = { sessionEnded: false };
    render(<SessionEndedNotice />);
    auth.value = {};
    render(<SessionEndedNotice />);
    expect(toast.warning).not.toHaveBeenCalled();
  });

  it('warns once when the session ended elsewhere', () => {
    auth.value = { sessionEnded: true };
    const { rerender } = render(<SessionEndedNotice />);
    rerender(<SessionEndedNotice />);
    expect(toast.warning).toHaveBeenCalledOnce();
    expect(toast.warning).toHaveBeenCalledWith(SESSION_ENDED_MESSAGE);
  });
});
