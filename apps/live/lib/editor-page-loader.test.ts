import { describe, expect, it, vi } from 'vitest';

const editor = vi.hoisted(() => ({ fail: true, imports: 0 }));
vi.mock('@/app/document/[id]/editor-page', () => {
  editor.imports++;
  if (editor.fail) {
    editor.fail = false;
    throw new Error('chunk failed');
  }
  return {
    default: function Editor() {
      return null;
    },
  };
});

import { loadEditorPage, loadedEditorPage } from './editor-page-loader';

describe('loadEditorPage', () => {
  it('asks again after a failed fetch, then keeps the editor', async () => {
    expect(loadedEditorPage()).toBeNull();
    await expect(loadEditorPage()).rejects.toThrow();
    const Editor = await loadEditorPage();
    expect(loadedEditorPage()).toBe(Editor);
    expect(await loadEditorPage()).toBe(Editor);
  });
});
