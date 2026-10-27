// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AddTabToDocumentDialog } from './TabOrganiseDialogs';

// Thumbnails load as they scroll into view; nothing scrolls here.
beforeEach(() => {
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

// Add to Document's filter matches names as the Explorer's lens does
// (docs/specs/013-workspace/explorer-filters.md "Titles elsewhere").
describe('AddTabToDocumentDialog', () => {
  const otherDocuments = [
    { id: 'typo', name: 'Sprint meetnig' },
    { id: 'kanban', name: 'Kanban' },
    { id: 'notes', name: 'Meeting notes' },
  ];
  const names = () =>
    screen
      .getAllByRole('button')
      .map((button) => button.textContent)
      .filter((text) => otherDocuments.some((d) => d.name === text));

  it('lists every other document in its order with an empty filter', () => {
    render(
      <AddTabToDocumentDialog
        ownerId={null}
        otherDocuments={otherDocuments}
        onPick={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(names()).toEqual(['Sprint meetnig', 'Kanban', 'Meeting notes']);
  });

  it('finds documents fuzzily, best match first', () => {
    render(
      <AddTabToDocumentDialog
        ownerId={null}
        otherDocuments={otherDocuments}
        onPick={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByRole('textbox', { name: 'Filter documents' }), {
      target: { value: 'meeting' },
    });
    expect(names()).toEqual(['Meeting notes', 'Sprint meetnig']);
  });
});
