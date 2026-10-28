// The document's name gives way first when the bottom line runs out of room (docs/specs/007-editor/toolbar-layout.md
// "When a line runs out of room").

import { describe, expect, it } from 'vitest';
import { docNameRoom } from './line-room';

describe('docNameRoom', () => {
  it('lets the name run to the room beside the tools group', () => {
    expect(docNameRoom({ line: 1416, tools: 300, document: 500, name: 200, dock: 0 })).toBe(808);
  });

  it('shortens the name so Draw’s dock fits centred between the groups', () => {
    // Half the line less half the dock, less the gap: (1416 - 540) / 2 - 8 = 430; the group holds 300 besides its name.
    expect(docNameRoom({ line: 1416, tools: 170, document: 500, name: 200, dock: 540 })).toBe(130);
  });

  it('never shortens the name under 72px', () => {
    expect(docNameRoom({ line: 600, tools: 300, document: 500, name: 200, dock: 0 })).toBe(72);
  });
});
