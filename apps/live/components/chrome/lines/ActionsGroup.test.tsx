// @vitest-environment jsdom

// The actions group, the top line's right (docs/specs/007-editor/toolbar-layout.md "The top line"): Search,
// Settings, the appearance toggle, a divider, the document actions that apply (Start Tour while offered, Make a Copy,
// Present, Share or Share Form), then the account control.

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth-config', () => ({ useSignInAvailable: () => true }));
vi.mock('@/components/providers/deferred-auth', () => ({
  useDeferredAuth: () => ({
    authLoaded: true,
    isSignedIn: true,
    user: { name: 'Webber Takken', email: 'w@example.com' },
    signOut: vi.fn(),
  }),
}));
vi.mock('@/components/chrome/auth-shared', () => ({
  useAuthHrefs: () => ({ signInHref: '/sign-in/' }),
}));
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

const { ActionsGroup } = await import('./ActionsGroup');
const { setFormShareHost } = await import('@/lib/form-share-store');
const { publishTourOffer, resetTourOffersForTests } = await import('@/components/tour/tour-offer');
const { resetTourOfferButtonForTests } = await import('@/components/tour/TourOfferButton');

afterEach(() => {
  cleanup();
  act(() => {
    setFormShareHost(null);
    resetTourOffersForTests();
  });
  resetTourOfferButtonForTests();
});

type Props = ComponentProps<typeof ActionsGroup>;
const base: Props = {
  onOpenSearch: vi.fn(),
  onOpenSettings: vi.fn(),
  documentActions: true,
  showShare: true,
  shareable: false,
  onOpenShare: vi.fn(),
};
const renderGroup = (props: Partial<Props> = {}) => render(<ActionsGroup {...base} {...props} />);

// The group's parts, each the names of its controls in order.
const parts = () =>
  [...document.querySelectorAll('[data-toolbar-actions] [data-toolbar-part]')]
    .map((part) =>
      [...part.querySelectorAll('button, a')]
        .filter((el) => !el.closest('[role="menu"]'))
        .map((el) => el.getAttribute('aria-label') ?? el.textContent?.trim()),
    )
    .filter((names) => names.length > 0);

describe('ActionsGroup', () => {
  it('holds the chrome trio, the document actions, then the account, each a part', () => {
    renderGroup({ present: { slideCount: 2, starting: false, onPresent: vi.fn() } });
    const [trio, actions, account] = parts();
    expect(trio).toEqual(['Search', 'Application settings', expect.stringMatching(/^Appearance/)]);
    expect(actions).toEqual(['Present', 'Share']);
    expect(account).toEqual(['Account menu']);
  });

  it('is a named toolbar at the top right the strip keeps clear of', () => {
    renderGroup();
    const group = screen.getByRole('toolbar', { name: 'Actions' });
    expect(group.hasAttribute('data-toolbar-actions')).toBe(true);
    expect(group.className).toContain('right-3');
    expect(group.className).toContain('top-3');
    expect(group.getAttribute('data-region')).toBe('actions');
  });

  it('offers Share to someone who may share, Make a Copy to a visitor, never both', () => {
    renderGroup();
    expect(screen.getByRole('button', { name: 'Share' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Copy' })).toBeNull();
    cleanup();
    const onMakeCopy = vi.fn();
    renderGroup({ showShare: false, onMakeCopy });
    expect(screen.queryByRole('button', { name: 'Share' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    expect(onMakeCopy).toHaveBeenCalledOnce();
  });

  it('reads Copying and refuses a second press while the copy is made', () => {
    renderGroup({ showShare: false, onMakeCopy: vi.fn(), copying: true });
    expect(screen.getByRole('button', { name: 'Copying' })).toHaveProperty('disabled', true);
  });

  it('shows a shared document as pressed', () => {
    renderGroup({ shareable: true });
    expect(screen.getByRole('button', { name: 'Share' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('puts Present before Share and starts the deck; Starting refuses a second press', () => {
    const onPresent = vi.fn();
    renderGroup({ present: { slideCount: 3, starting: false, onPresent } });
    const present = screen.getByRole('button', { name: 'Present' });
    const share = screen.getByRole('button', { name: 'Share' });
    expect(present.compareDocumentPosition(share) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(present);
    expect(onPresent).toHaveBeenCalledOnce();
    cleanup();
    renderGroup({ present: { slideCount: 3, starting: true, onPresent } });
    expect(screen.getByRole('button', { name: 'Starting' })).toHaveProperty('disabled', true);
  });

  it('swaps Share for Share Form on a form tab, one share button, never two', () => {
    const open = vi.fn();
    act(() => setFormShareHost({ published: false, open }));
    renderGroup();
    expect(screen.queryByRole('button', { name: 'Share' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Share Form' }));
    expect(open).toHaveBeenCalledOnce();
  });

  it('leads the document actions with Start Tour while one is offered', () => {
    act(() =>
      publishTourOffer('diagram', { id: 'diagram', name: 'Diagram', rank: 1, start: vi.fn() }),
    );
    renderGroup();
    expect(parts()[1]![0]).toBe('Start Diagram Tour');
  });

  it('through the welcome flow, holds the account control alone', () => {
    renderGroup({
      documentActions: false,
      present: { slideCount: 1, starting: false, onPresent: vi.fn() },
    });
    expect(parts()).toEqual([['Account menu']]);
  });

  it('carries Open in LiveDoc in a workbench, and no appearance toggle there', () => {
    renderGroup({ workbenchOpenHref: '/document/d1' });
    expect(
      screen
        .getByRole('link', { name: 'Open in LiveDoc (opens in a new tab)' })
        .getAttribute('href'),
    ).toBe('/document/d1');
    expect(parts()[0]).toEqual(['Search', 'Application settings']);
  });

  it('opens Settings on Account in place from the account menu', () => {
    const onOpenAccount = vi.fn();
    renderGroup({ onOpenAccount });
    fireEvent.click(screen.getByRole('button', { name: 'Account menu' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Account' }));
    expect(onOpenAccount).toHaveBeenCalledOnce();
  });
});
