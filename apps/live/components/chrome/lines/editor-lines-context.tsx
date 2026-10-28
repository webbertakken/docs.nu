'use client';

import { createContext, useContext, type ReactNode } from 'react';

// What the editor page hands the canvas chrome for its two lines (docs/specs/007-editor/blueprints/two-lines.md):
// the actions group and the document group, built where their state lives (the page), placed where the lines are
// measured (CanvasChrome), so no group's props run through the canvas. Null outside the editor page (an embed, a
// test), where the chrome draws neither group; either node is null where its group is not drawn.
export type EditorLines = {
  actions: ReactNode;
  document: ReactNode;
};

export const EditorLinesContext = createContext<EditorLines | null>(null);

export function useEditorLines(): EditorLines | null {
  return useContext(EditorLinesContext);
}
