// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NewDocumentButton } from './NewDocumentButton';
import { startNewDocument } from './start-new-document';
import { takeStartGroup } from '@/components/start/start-group';
import { writeLastBlank } from '@/lib/new-document/last-blank';

vi.mock('./start-new-document', () => ({ startNewDocument: vi.fn() }));

const started = vi.mocked(startNewDocument);

async function openMenu() {
  fireEvent.click(screen.getByRole('button', { name: 'More new document choices' }));
  return screen.findByRole('menu', { name: 'New Document' });
}

// docs/specs/013-workspace/new-document-menu.md
describe('NewDocumentButton', () => {
  beforeEach(() => {
    act(() => writeLastBlank('diagram'));
  });
  afterEach(() => {
    started.mockClear();
    sessionStorage.clear();
  });

  it('makes the last blank from its face, at once', () => {
    render(<NewDocumentButton place={{ folderId: 'f1' }} />);
    fireEvent.click(screen.getByRole('button', { name: 'New Diagram' }));
    expect(started).toHaveBeenCalledWith({
      choice: 'blank',
      blank: 'diagram',
      template: 'blank',
      place: { folderId: 'f1' },
    });
  });

  it('names its face after the blank made last', async () => {
    render(<NewDocumentButton place={{}} />);
    await openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Sheet, blank' }));
    expect(started).toHaveBeenLastCalledWith(
      expect.objectContaining({ choice: 'blank', blank: 'sheet', template: 'blank-spreadsheet' }),
    );
    expect(screen.getByRole('button', { name: 'New Sheet' })).toBeTruthy();
  });

  it('opens the menu on the last blank, its row focused', async () => {
    act(() => writeLastBlank('form'));
    render(<NewDocumentButton place={{}} />);
    await openMenu();
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Form, blank' })),
    );
    expect(screen.getByRole('group', { name: 'Form templates' })).toBeTruthy();
  });

  it('lists the eight blanks, each with its number key', async () => {
    render(<NewDocumentButton place={{}} />);
    await openMenu();
    const rows = screen
      .getAllByRole('menuitem')
      .filter((el) => el.getAttribute('aria-label')?.endsWith(', blank'));
    expect(rows.map((r) => r.getAttribute('aria-keyshortcuts'))).toEqual([
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
      '8',
    ]);
  });

  it('makes a blank from its number key', async () => {
    render(<NewDocumentButton place={{}} />);
    const menu = await openMenu();
    fireEvent.keyDown(menu.querySelector('[data-spot="list:0"]')!, { key: '5' });
    expect(started).toHaveBeenCalledWith(
      expect.objectContaining({ blank: 'board', template: 'blank-board' }),
    );
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('makes a template from its card', async () => {
    render(<NewDocumentButton place={{}} />);
    await openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Flowchart' }));
    expect(started).toHaveBeenCalledWith(
      expect.objectContaining({ choice: 'template', blank: 'diagram', template: 'flowchart' }),
    );
  });

  it('opens a group of the picker from All templates', async () => {
    act(() => writeLastBlank('page'));
    render(<NewDocumentButton place={{}} />);
    await openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: /^All \d+ Page templates$/ }));
    expect(started).toHaveBeenCalledWith(
      expect.objectContaining({
        choice: 'all-templates',
        blank: 'page',
        template: 'blank-illustration',
      }),
    );
    expect(takeStartGroup()).toBe('articles');
  });

  it('moves along the list and into the pane with the arrow keys', async () => {
    render(<NewDocumentButton place={{}} />);
    const menu = await openMenu();
    const first = menu.querySelector<HTMLElement>('[data-spot="list:0"]')!;
    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(
      screen.getByRole('menuitem', { name: 'Whiteboard, blank' }),
    );
    expect(screen.getByRole('group', { name: 'Whiteboard templates' })).toBeTruthy();
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowLeft' });
    expect(document.activeElement?.textContent).toContain('Blank Whiteboard');
  });

  it('offers New Folder in the menu where the section does', async () => {
    const onCreateFolder = vi.fn();
    render(
      <NewDocumentButton place={{}} onCreateFolder={onCreateFolder} folderLabel="New Subfolder" />,
    );
    await openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'New Subfolder' }));
    expect(onCreateFolder).toHaveBeenCalledOnce();
    expect(started).not.toHaveBeenCalled();
  });
});
