'use client';

import { HoverCard } from '@livedoc/ui';
import { LayersStackIcon } from '@/components/panels/layers-panel-icons';
import { CLUSTER_CONTROL_REST } from '@/components/canvas/cluster-strip';
import { ClusterPopoverSegment, ClusterStrip } from './ClusterPopoverButton';
import { ThemeLookIcon } from '@/components/palette/palette-icons';

// Layers and the Theme & canvas button, one strip in the bottom-right cluster
// (docs/specs/007-editor/live-app.md): both shape how the tab looks rather than what is on it, so
// they sit together in every mode. A mode without Layers (Plan, Pages) or a session without
// the Theme & canvas button (a view-only visitor, a whiteboard) keeps whichever of the two it has.
// Both are icons alone on every width, named by their labels and hover cards.
//
// Layers opens its panel as a popover above it (docs/specs/006-document/layers.md); the palette
// opens the CanvasThemeDialog (docs/specs/011-theme/canvas-and-theme-dialog.md).
export function LayersThemeStrip({
  layers,
  onOpenTheme,
}: {
  // The Layers button: its popover's state and toggle. Absent, the strip has none.
  layers?: { open: boolean; onToggle: (button: HTMLElement) => void } | undefined;
  // The Theme & canvas button. Absent, the strip has none.
  onOpenTheme?: (() => void) | undefined;
}) {
  if (!layers && !onOpenTheme) return null;
  return (
    <ClusterStrip>
      {layers ? (
        <ClusterPopoverSegment
          label="Open Layers"
          hoverTitle="Open Layers"
          hoverDescription="Show this tab's layers."
          icon={<LayersStackIcon />}
          popoverOpen={layers.open}
          onTogglePopover={layers.onToggle}
        />
      ) : null}
      {onOpenTheme ? (
        <HoverCard
          title="Theme & canvas"
          description="Change this tab's theme and canvas background."
        >
          <button
            type="button"
            data-tour-id="canvas-theme"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onOpenTheme}
            aria-label="Theme and canvas"
            className={`flex h-11 w-11 items-center justify-center transition ${
              layers ? 'border-l border-slate-100 dark:border-slate-800' : ''
            } ${CLUSTER_CONTROL_REST}`}
          >
            <ThemeLookIcon />
          </button>
        </HoverCard>
      ) : null}
    </ClusterStrip>
  );
}
