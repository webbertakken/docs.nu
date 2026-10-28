import { describe, expect, it } from 'vitest';
import { paneCreateMode } from './pane-create-action';

// docs/specs/013-workspace/new-document-menu.md "The button"
describe('paneCreateMode', () => {
  it('shows the New Document menu wherever New Document is offered, New Folder inside it', () => {
    expect(paneCreateMode({ hasCreateDocument: true, hasCreateFolder: true })).toEqual({
      kind: 'new-document',
    });
    expect(paneCreateMode({ hasCreateDocument: true, hasCreateFolder: false })).toEqual({
      kind: 'new-document',
    });
  });

  it('renders a lone New Folder directly', () => {
    expect(paneCreateMode({ hasCreateDocument: false, hasCreateFolder: true })).toEqual({
      kind: 'new-folder',
    });
  });

  it('renders nothing for the read-only sections', () => {
    expect(paneCreateMode({ hasCreateDocument: false, hasCreateFolder: false })).toEqual({
      kind: 'none',
    });
  });
});
