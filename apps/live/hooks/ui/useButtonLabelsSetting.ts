'use client';

import { createContext, createElement, useContext, type ReactNode } from 'react';

// The reader's Settings > Appearance > Button Labels (`dockButtonNames`), on outside a provider
// (docs/specs/007-editor/user-preferences.md). It names the footer bar's buttons (Search, Settings, the
// theme) beside their icons; the bottom-right cluster is icons alone whatever it says
// (docs/specs/007-editor/live-app.md). A phone shows the footer's as icons whatever it says.
const ButtonLabelsSetting = createContext(true);

/** The Button Labels setting, read by the footer bar under its own width rule. */
export function useButtonLabelsSetting(): boolean {
  return useContext(ButtonLabelsSetting);
}

export function ButtonLabelsProvider({ value, children }: { value: boolean; children: ReactNode }) {
  return createElement(ButtonLabelsSetting.Provider, { value }, children);
}
