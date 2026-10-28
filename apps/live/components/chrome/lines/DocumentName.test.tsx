// @vitest-environment jsdom

// The document group's start (docs/specs/007-editor/toolbar-layout.md "The bottom line"): the share-state icon, the
// name (click to rename, for someone who may) and the role pill, as they were in the header.

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

const { DocumentName } = await import('./DocumentName');

afterEach(cleanup);

function renderName() {
  return render(
    <DocumentName
      documentName="Untitled document"
      showShare
      shareable={false}
      onOpenShare={() => {}}
      onRename={() => {}}
    />,
  );
}

describe('DocumentName rename requests', () => {
  const header = (renameNonce: number) => (
    <DocumentName
      documentName="Untitled document"
      showShare={false}
      shareable={false}
      onOpenShare={() => {}}
      onRename={() => {}}
      renameNonce={renameNonce}
    />
  );
  const editing = () => screen.queryByDisplayValue('Untitled document');

  it('opens the name editor for a request, never on mount', () => {
    const { rerender } = render(header(0));
    expect(editing()).toBeNull();
    rerender(header(1));
    expect(editing()).not.toBeNull();
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
describe('DocumentName title on a touch screen', () => {
  it('pads the rename button to 44px tall without a clipped pad', () => {
    renderName();
    const title = screen.getByRole('button', { name: 'Untitled document' });
    expect(title.className).toMatch(/\bpointer-coarse:py-3\b/);
    expect(title.className).toMatch(/\btruncate\b/);
    expect(title.className).not.toMatch(/\btouch-target/);
  });
});

// docs/specs/012-collaboration/presentation-mode.md "The header's Present button".
describe('DocumentName with a long name', () => {
  it('shortens the name with an ellipsis, down to the 72px floor, the icon and pill whole', () => {
    renderName();
    const name = screen.getByRole('button', { name: 'Untitled document' });
    expect(name.className).toContain('truncate');
    const box = name.closest<HTMLElement>('[data-doc-name]')!;
    expect(box.className).toContain('min-w-[72px]');
    expect(box.className).toContain('max-w-[var(--doc-name-max,20rem)]');
  });

  it('is not drawn on a phone; the share-state icon and the role pill stay', () => {
    render(
      <DocumentName
        documentName="Untitled document"
        showShare
        shareable={false}
        onOpenShare={() => {}}
        onRename={() => {}}
        rolePill={<span data-testid="pill">EDITING</span>}
      />,
    );
    const box = document.querySelector<HTMLElement>('[data-doc-name]')!;
    expect(box.className).toMatch(/(^|\s)phone:hidden(\s|$)/);
    expect(screen.getByTestId('pill').closest('.phone\\:hidden')).toBeNull();
  });
});

// docs/specs/007-editor/live-app.md "The top bar's middle", now the document group's start: the share-state icon,
// then the name.
describe('DocumentName', () => {
  const middle = (props: Partial<Parameters<typeof DocumentName>[0]> = {}) =>
    render(
      <DocumentName
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
