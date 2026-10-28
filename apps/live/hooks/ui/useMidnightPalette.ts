'use client';

import { useLayoutEffect } from 'react';
import { syncChromeColour } from '@livedoc/ui';

// Midnight (docs/specs/004-interface-design/color-scheme.md "Midnight: the account and connect pages"). While an
// account or connect page (AuthStage) is mounted the document root carries `data-palette="midnight"`, which dark mode
// reads as the navy ground and sky accent; menus and dialogs portalled to the body follow it. Set before the first
// paint, removed on unmount, so the Explorer, the editor and every other page keep Steel. The browser's chrome follows
// it both ways (docs/specs/004-interface-design/appearance.md "The browser's chrome").

export const MIDNIGHT_PALETTE = 'midnight';

export function useMidnightPalette(): void {
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.palette = MIDNIGHT_PALETTE;
    syncChromeColour();
    return () => {
      if (root.dataset.palette === MIDNIGHT_PALETTE) delete root.dataset.palette;
      syncChromeColour();
    };
  }, []);
}
