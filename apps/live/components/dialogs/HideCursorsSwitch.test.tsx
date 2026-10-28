// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Tab } from '@livedoc/document';
import type { AccessLevel } from '@livedoc/api-schema';
import type { Participant } from '@/lib/identity';
import { storageEvent } from '@/lib/testing/storage-event';

// Hide Participant Cursors (docs/specs/012-collaboration/collaborator-enhancements.md §2): one switch in two
// places, Settings › Panels › Collaborate and the foot of the Collaborators modal, every role's, since it only
// changes what this screen draws.

const track = vi.hoisted(() => vi.fn());
vi.mock('@/lib/telemetry', () => ({ track }));
vi.mock('@/lib/account-manage', () => ({
  ACCOUNT_NAME_MAX: 100,
  readGoogleAccount: async () => false,
  readAccountSessions: async () => [],
}));

const { HIDE_CURSORS_KEY } = await import('@/hooks/collab/useHideCursors');
const { CollaboratorsDialog } = await import('./CollaboratorsDialog');
const { SETTINGS_CATEGORIES } = await import('./settings/settings-catalogue');
const { SettingsCategoryPane } = await import('./settings/SettingsCategoryPane');

afterEach(() => {
  cleanup();
  track.mockClear();
  window.localStorage.clear();
  act(() => {
    window.dispatchEvent(storageEvent({ key: null }));
  });
});

const person = (id: string, name: string): Participant => ({
  id,
  name,
  color: '#0ea5e9',
  status: 'online',
});
const tabs = [{ id: 't1', name: 'Overview' }] as unknown as Tab[];

function openModal(selfRole: AccessLevel) {
  return render(
    <CollaboratorsDialog
      participantsByTab={new Map([['t1', [person('me', 'Me'), person('sam', 'Sam')]]])}
      tabs={tabs}
      activeId="t1"
      selfId="me"
      selfRole={selfRole}
      focusId={null}
      followingId={null}
      onFollow={vi.fn()}
      onStopFollowing={vi.fn()}
      facilitatorId={null}
      isFacilitator={false}
      isOwner={false}
      onMakeFacilitator={vi.fn()}
      onTakeFacilitation={vi.fn()}
      onStepDown={vi.fn()}
      onGoToTab={vi.fn()}
      onClose={vi.fn()}
    />,
  );
}

const COLLABORATE = SETTINGS_CATEGORIES.find((c) => c.id === 'collaborate')!;
const theSwitch = () => screen.getByRole('switch', { name: /Hide Participant Cursors/ });

describe('Hide Participant Cursors in the Collaborators modal', () => {
  it.each(['edit', 'participate', 'view'] as const)('offers the switch to a %s visitor', (role) => {
    openModal(role);
    expect(theSwitch().getAttribute('aria-checked')).toBe('false');
  });

  it("flips this device's choice, reporting it first", () => {
    openModal('view');
    fireEvent.click(theSwitch());
    expect(window.localStorage.getItem(HIDE_CURSORS_KEY)).toBe('true');
    expect(theSwitch().getAttribute('aria-checked')).toBe('true');
    expect(track).toHaveBeenCalledWith('UI', 'Toggled', 'HideCursorsOn');
  });
});

describe('Hide Participant Cursors in Settings', () => {
  it('sits under Collaborate, after the panel switch, and reads the same store as the modal', () => {
    expect(COLLABORATE.rows.map((r) => r.kind)).toEqual(['toggle', 'hideCursors']);
    render(<SettingsCategoryPane category={COLLABORATE} settings={{}} onChange={vi.fn()} />);
    fireEvent.click(theSwitch());
    expect(window.localStorage.getItem(HIDE_CURSORS_KEY)).toBe('true');
    expect(track).toHaveBeenCalledWith('UI', 'Toggled', 'HideCursorsOn');
    cleanup();
    openModal('edit');
    expect(theSwitch().getAttribute('aria-checked')).toBe('true');
  });
});
