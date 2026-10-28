// Which shape the Explorer header's create action takes (docs/specs/013-workspace/new-document-menu.md "The button",
// docs/specs/013-workspace/folders.md "Create"). A section that offers New Document shows the New Document menu's split
// button, with New Folder inside its menu where the section offers that too; a section offering only New Folder shows
// that one button, named; a section offering neither shows nothing.
//
// Kept pure and separate from PaneHeader.tsx so the branch is unit-testable
// without mounting the header (docs/specs/003-system-architecture/testing.md).

type PaneCreateMode = { kind: 'none' } | { kind: 'new-document' } | { kind: 'new-folder' };

export function paneCreateMode(opts: {
  hasCreateDocument: boolean;
  hasCreateFolder: boolean;
}): PaneCreateMode {
  if (opts.hasCreateDocument) return { kind: 'new-document' };
  if (opts.hasCreateFolder) return { kind: 'new-folder' };
  return { kind: 'none' };
}
