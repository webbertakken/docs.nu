// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// Header stack row (docs/specs/004-interface-design/optical-alignment.md, "A stack row shares one line"):
// every header action holds its glyph in the same 20px icon slot, so an avatar beside a 13px icon no
// longer drops its label below its neighbour's.

vi.mock('@/lib/auth-config', () => ({ useSignInAvailable: () => true }));
vi.mock('@/components/providers/deferred-auth', () => ({
  useDeferredAuth: () => ({
    authLoaded: true,
    isSignedIn: true,
    user: { firstName: 'Webber', fullName: 'Webber Takken', email: 'w@example.com' },
    signOut: vi.fn(),
  }),
}));
vi.mock('@/components/chrome/auth-shared', () => ({
  useAuthHrefs: () => ({ signInHref: '/sign-in/' }),
}));
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

const { EditorHeader } = await import('./EditorHeader');
const { HEADER_ICON_SLOT_PX } = await import('./header-action');

afterEach(cleanup);

function renderHeader() {
  return render(
    <EditorHeader
      documentName="Untitled document"
      showShare
      shareable={false}
      onMakeCopy={() => {}}
      onOpenShare={() => {}}
      onRename={() => {}}
    />,
  );
}

describe('EditorHeader stack row', () => {
  it('uses a 20px slot', () => {
    expect(HEADER_ICON_SLOT_PX).toBe(20);
  });

  it.each([['Copy'], ['Share'], ['Account menu']])(
    '%s holds its glyph in the shared slot',
    (name) => {
      renderHeader();
      const action = screen.getByRole('button', { name: new RegExp(name) });
      const slot = action.firstElementChild as HTMLElement;
      expect(slot.dataset.optical).toBe('slot');
      expect(slot.style.width).toBe(`${HEADER_ICON_SLOT_PX}px`);
      expect(slot.style.height).toBe(`${HEADER_ICON_SLOT_PX}px`);
    },
  );

  it('draws the account avatar, its initial as a glyph disc filling the slot', () => {
    renderHeader();
    const slot = screen.getByRole('button', { name: 'Account menu' })
      .firstElementChild as HTMLElement;
    // The account avatar (docs/specs/014-identity/profile-picture.md) holds the slot at its size.
    const avatar = slot.firstElementChild as HTMLElement;
    expect(avatar.dataset.avatarState).toBe('initial');
    expect(avatar.style.width).toBe(`${HEADER_ICON_SLOT_PX}px`);
    const disc = avatar.firstElementChild as HTMLElement;
    expect(disc.dataset.optical).toBe('disc');
    expect(disc.style.width).toBe(`${HEADER_ICON_SLOT_PX}px`);
    expect(disc.querySelector('.text-optical-centre')?.textContent).toBe('W');
  });
});

// The account menu's Account item opens Settings in place
// (docs/specs/007-editor/user-preferences.md) instead of navigating to the Explorer.
describe('EditorHeader account menu', () => {
  it('opens Settings on Account in place when the host can', () => {
    const onOpenAccount = vi.fn();
    render(
      <EditorHeader
        documentName="d"
        showShare={false}
        shareable={false}
        onOpenShare={() => {}}
        onOpenAccount={onOpenAccount}
        onRename={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Account menu' }));
    const item = screen.getByRole('menuitem', { name: 'Account' });
    expect(item.tagName).toBe('BUTTON');
    fireEvent.click(item);
    expect(onOpenAccount).toHaveBeenCalledOnce();
    // The account menu closes (the section switch keeps its own menu mounted).
    expect(screen.queryByRole('menuitem', { name: 'Account' })).toBeNull();
  });

  it('falls back to the Explorer deep link without a handler', () => {
    renderHeader();
    fireEvent.click(screen.getByRole('button', { name: 'Account menu' }));
    expect(screen.getByRole('menuitem', { name: 'Account' }).getAttribute('href')).toBe(
      '/explorer?settings=account',
    );
  });
});

describe('EditorHeader rename requests', () => {
  const header = (renameNonce: number, hideTitle = false) => (
    <EditorHeader
      documentName="Untitled document"
      showShare={false}
      shareable={false}
      onOpenShare={() => {}}
      onRename={() => {}}
      renameNonce={renameNonce}
      hideTitle={hideTitle}
    />
  );
  const editing = () => screen.queryByDisplayValue('Untitled document');

  it('opens the name editor for a request, never on mount', () => {
    const { rerender } = render(header(0));
    expect(editing()).toBeNull();
    rerender(header(1));
    expect(editing()).not.toBeNull();
  });

  it('honours a request made while the title is hidden once it shows, and only once', () => {
    const { rerender } = render(header(0, true));
    rerender(header(1, true));
    expect(editing()).toBeNull();
    rerender(header(1, false));
    expect(editing()).not.toBeNull();
    fireEvent.blur(screen.getByDisplayValue('Untitled document'));
    expect(editing()).toBeNull();
    rerender(header(1, true));
    rerender(header(1, false));
    expect(editing()).toBeNull();
  });

  it('hands focus back to the title when a rename ends from the keyboard', async () => {
    // The field goes as the rename ends, so Escape (or Enter) left focus on the page (NameEditor).
    render(header(0));
    fireEvent.click(screen.getByRole('button', { name: 'Untitled document' }));
    fireEvent.keyDown(screen.getByDisplayValue('Untitled document'), { key: 'Escape' });
    expect(editing()).toBeNull();
    await act(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Untitled document' }));
  });
});

// docs/specs/004-interface-design/touch-targets.md: the document title is a 44px-tall tap target on a
// touch screen, by padding, since `truncate` would clip a ::before pad.
describe('EditorHeader title on a touch screen', () => {
  it('pads the rename button to 44px tall without a clipped pad', () => {
    renderHeader();
    const title = screen.getByRole('button', { name: 'Untitled document' });
    expect(title.className).toMatch(/\bpointer-coarse:py-3\b/);
    expect(title.className).toMatch(/\btruncate\b/);
    expect(title.className).not.toMatch(/\btouch-target/);
  });
});

// docs/specs/012-collaboration/presentation-mode.md "The header's Present button".
describe('EditorHeader Present button', () => {
  const header = (present?: Parameters<typeof EditorHeader>[0]['present']) =>
    render(
      <EditorHeader
        documentName="Deck"
        showShare
        shareable={false}
        onOpenShare={() => {}}
        onRename={() => {}}
        present={present}
      />,
    );

  it('is absent without a deck to present', () => {
    header();
    expect(screen.queryByRole('button', { name: /Present/ })).toBeNull();
  });

  it('sits immediately left of Share and starts the deck', () => {
    const onPresent = vi.fn();
    header({ slideCount: 3, starting: false, onPresent });
    const present = screen.getByRole('button', { name: 'Present' });
    const share = screen.getByRole('button', { name: 'Share' });
    expect(present.compareDocumentPosition(share) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(present);
    expect(onPresent).toHaveBeenCalledOnce();
  });

  it('reads Starting and refuses a second press while the deck loads', () => {
    const onPresent = vi.fn();
    header({ slideCount: 3, starting: true, onPresent });
    const button = screen.getByRole('button', { name: 'Starting' });
    expect(button).toHaveProperty('disabled', true);
  });

  it('links the logo to the Explorer home, not the homepage', () => {
    renderHeader();
    expect(screen.getByRole('link', { name: 'LiveDoc' }).getAttribute('href')).toBe(
      '/explorer/home',
    );
  });
});

// A long document name truncates rather than pushing the header's actions off a phone: every flex box between the
// header row and the name may shrink below its content (min-w-0), and the actions never shrink. jsdom does no layout,
// so this holds the classes that make the layout work.
describe('EditorHeader with a long name', () => {
  it('lets the name shrink and keeps the actions whole', () => {
    const { container } = renderHeader();
    const header = container.firstElementChild as HTMLElement;
    const name = screen.getByRole('button', { name: 'Untitled document' });
    expect(name.className).toContain('truncate');
    for (let el = name.parentElement; el && el !== header; el = el.parentElement) {
      expect(el.className, el.outerHTML.slice(0, 80)).toContain('min-w-0');
    }
    const actions = screen.getByRole('button', { name: /Share/ }).closest('.self-stretch');
    expect(actions?.className).toContain('shrink-0');
  });
});

// docs/specs/007-editor/live-app.md "The top bar's middle": the share-state icon, then the name.
describe("EditorHeader top bar's middle", () => {
  const middle = (props: Partial<Parameters<typeof EditorHeader>[0]> = {}) =>
    render(
      <EditorHeader
        documentName="Payments architecture"
        showShare
        shareable={false}
        onOpenShare={() => {}}
        onRename={() => {}}
        {...props}
      />,
    ).container.querySelector<HTMLElement>('[data-title-bar-middle]')!;

  it('puts the share-state icon before the name, at every width', () => {
    const box = middle();
    const icon = box.querySelector<HTMLElement>('[data-share-state-icon]')!;
    expect(icon.dataset.shareStateIcon).toBe('private');
    const name = screen.getByRole('button', { name: 'Payments architecture' });
    expect(icon.compareDocumentPosition(name) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // Never hidden on a phone: no ancestor inside the middle hides it below `sm`.
    for (let el: HTMLElement | null = icon; el && el !== box; el = el.parentElement)
      expect(el.className).not.toMatch(/(^|\s)hidden(\s|$)/);
  });

  it.each([
    [{ shareable: true }, 'shared', 'Shared'],
    [{ teamDocument: true }, 'team', 'Team'],
    [{ offline: true }, 'offline', 'This Browser'],
  ] as const)('shows the state %o as %s', (props, state, label) => {
    const box = middle(props);
    expect(box.querySelector<HTMLElement>('[data-share-state-icon]')!.dataset.shareStateIcon).toBe(
      state,
    );
    expect(screen.getByRole('button', { name: label })).toBeTruthy();
  });

  it('opens Share from the icon for someone who may share', () => {
    const onOpenShare = vi.fn();
    middle({ onOpenShare });
    fireEvent.click(screen.getByRole('button', { name: 'Private' }));
    expect(onOpenShare).toHaveBeenCalledOnce();
  });

  it('leaves the icon a named, focusable anchor for someone who may not share', () => {
    middle({ showShare: false });
    expect(screen.queryByRole('button', { name: 'Private' })).toBeNull();
    const icon = screen.getByLabelText('Private');
    expect(icon.tabIndex).toBe(0);
  });

  it('renames in place from the name, and only reads it out when the role may not rename', () => {
    const onRename = vi.fn();
    middle({ onRename });
    fireEvent.click(screen.getByRole('button', { name: 'Payments architecture' }));
    const field = screen.getByDisplayValue('Payments architecture');
    // The icon stays while renaming.
    expect(document.querySelector('[data-share-state-icon]')).not.toBeNull();
    fireEvent.change(field, { target: { value: 'Payments' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(onRename).toHaveBeenCalledWith('Payments');
    cleanup();
    middle({ readOnly: true });
    expect(screen.queryByRole('button', { name: 'Payments architecture' })).toBeNull();
    expect(screen.getByText('Payments architecture')).toBeTruthy();
  });
});
