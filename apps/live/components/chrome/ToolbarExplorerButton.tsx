'use client';

import { track } from '@/lib/telemetry';
import { HoverCard, Glyph } from '@livedoc/ui';
import { TOOLBAR_CONTROL_PRESSED, TOOLBAR_ICON_BUTTON } from './toolbar-surface';

// The menu button (☰, docs/specs/007-editor/toolbar-layout.md "The top line"), in the brand group. It toggles the
// Explorer panel open as a popover hanging under it, through the dock's popover path (it hands itself to the toggle
// as the anchor), so it is the real Explorer, not a second menu that could drift from it. The brand group carries
// `data-dock-button`, so pressing this while the Explorer is open closes it via the toggle rather than closing it on
// pointer-down and reopening it on click.
export function ToolbarExplorerButton({
  open,
  onToggle,
}: {
  open: boolean;
  // Given the button itself, which the popover anchors to.
  onToggle: (button: HTMLElement) => void;
}) {
  return (
    // No hover card while open: it would sit over the panel it names. Disabled, not unwrapped, so the button keeps
    // its focus as the panel opens.
    <HoverCard title="Explorer" description="Your documents, folders and teams." disabled={open}>
      <button
        type="button"
        aria-label="Explorer"
        aria-expanded={open}
        onClick={(e) => {
          if (!open) track('UI', 'Opened', 'ToolbarExplorer');
          onToggle(e.currentTarget);
        }}
        className={`${TOOLBAR_ICON_BUTTON} ${open ? TOOLBAR_CONTROL_PRESSED : ''}`}
      >
        <Glyph size={18} units={20} strokeLinejoin="miter">
          <path d="M4 6h12M4 10h12M4 14h12" />
        </Glyph>
      </button>
    </HoverCard>
  );
}
