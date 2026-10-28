import { TOOLBAR_PART } from '@/components/chrome/ToolbarGroup';
import { TOOLBAR_CONTROL_REST } from '@/components/chrome/toolbar-surface';

// The tools group's parts (docs/specs/007-editor/toolbar-layout.md "The bottom line"): Undo / Redo, the Session strip,
// the mode's strip, Collaborate, Layers and Theme, Zoom. Each strip is a part of the one group, a divider before it,
// its buttons the group's flat 36px controls, so the cluster reads as one toolbar. A strip marks itself
// `data-toolbar-part` (the divider rule reads it).

/** A strip's run of buttons inside the tools group. */
export const CLUSTER_STRIP = `pointer-events-auto animate-fade-in ${TOOLBAR_PART}`;

/** A cluster button at rest (not pressed, its popover closed): the group's hover fill. */
export const CLUSTER_CONTROL_REST = TOOLBAR_CONTROL_REST;
