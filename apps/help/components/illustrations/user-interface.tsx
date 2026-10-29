// User-Interface-category illustrations (docs/specs/018-help/help-app.md): where the editor's
// panels and fixed controls sit (the two lines: the brand group, the actions group with its quick
// controls, the tools group and the document group, with the tab list), the selection toolbars, the
// element menu and the Map. Labels are the editor's own (apps/live: chrome/lines, ChromeControls,
// CanvasChrome, ZoomMenu, SelectionPopover, MultiSelectionToolbar, EditorContextMenu). Composed from
// the shared primitives and the two lines (editor-lines.tsx) so the house style holds.

import type { ReactNode } from 'react';
import { Scene, Shape, Arrow, SelectionBox, Panel, Label } from './primitives';
import {
  ActionsGroup,
  BrandGroup,
  BRAND_W,
  DocumentGroup,
  MiniStrip,
  SAMPLE_PEOPLE,
  TabList,
  ToolsGroup,
  actionsGroupWidth,
  tabListHeight,
  tabStackCentre,
  toolsGroupWidth,
  type TabListRow,
} from './editor-lines';

// --- Glyphs ------------------------------------------------------------------

const GLYPH = {
  className: 'stroke-slate-500',
  strokeWidth: 1.6,
  fill: 'none',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

function DotsGlyph({ x, y, tone = 'slate' }: { x: number; y: number; tone?: 'slate' | 'brand' }) {
  const cls = tone === 'brand' ? 'fill-brand-500' : 'fill-slate-400';
  return (
    <g>
      <circle cx={x - 4} cy={y} r={1.3} className={cls} />
      <circle cx={x} cy={y} r={1.3} className={cls} />
      <circle cx={x + 4} cy={y} r={1.3} className={cls} />
    </g>
  );
}

/** A square icon button on a toolbar or in the corner cluster. */
function IconButton({
  x,
  y,
  size = 24,
  children,
}: {
  x: number;
  y: number;
  size?: number;
  children: ReactNode;
}) {
  return (
    <g>
      <rect x={x} y={y} width={size} height={size} rx={6} className="fill-slate-50" />
      <g transform={`translate(${x + size / 2} ${y + size / 2})`}>{children}</g>
    </g>
  );
}

// --- Scenes ------------------------------------------------------------------

/** The whole frame at a glance: the brand group top-left, the Palette strip across the top, the actions group
 *  top-right with the AI panel docked under it, the Map bottom-left over the tools group, and the document group
 *  bottom-right. */
export function PanelLayout() {
  const W = 600;
  const actionsLeft = W - 12 - actionsGroupWidth({});
  const stripX = 12 + BRAND_W + 16;
  return (
    <Scene w={W} h={290}>
      <BrandGroup x={12} y={12} />
      <MiniStrip x={stripX} y={12} w={actionsLeft - 16 - stripX} />
      <ActionsGroup right={W - 12} y={12} />
      <Panel x={W - 132} y={56} w={120} h={70} title="AI ASSISTANT">
        {[0, 1].map((i) => (
          <rect
            key={i}
            x={W - 120}
            y={88 + i * 14}
            width={i === 0 ? 86 : 60}
            height={6}
            rx={3}
            className={i === 0 ? 'fill-brand-200' : 'fill-slate-200'}
          />
        ))}
      </Panel>
      <Shape x={236} y={70} w={90} h={38} label="Start" />
      <Shape x={236} y={136} w={90} h={38} accent label="Ship" />
      <Arrow from={[281, 108]} to={[281, 136]} />
      <Panel x={12} y={152} w={110} h={86} title="MAP">
        <rect x={36} y={184} width={14} height={8} rx={2} className="fill-slate-300" />
        <rect x={36} y={198} width={14} height={8} rx={2} className="fill-slate-300" />
        <rect
          x={28}
          y={180}
          width={46}
          height={30}
          rx={3}
          fill="none"
          className="stroke-brand-500"
          strokeWidth={1.4}
        />
      </Panel>
      <ToolsGroup x={12} y={246} />
      <DocumentGroup right={W - 12} y={246} />
    </Scene>
  );
}

/** The quick controls, close up: Search, Report a Bug, Settings and the appearance switch, ringed, at the start of
 *  the actions group, before Share and the account. */
export function QuickControls() {
  const W = 420;
  return (
    <Scene w={W} h={130}>
      <Shape x={60} y={70} w={90} h={40} label="Idea" />
      <ActionsGroup right={W - 12} y={16} ring />
      <Label
        x={W - 12 - actionsGroupWidth({}) + 50}
        y={66}
        size={10}
        weight={600}
        tone="accent"
        anchor="middle"
      >
        Quick controls
      </Label>
    </Scene>
  );
}

const TAB_LIST_ROWS: TabListRow[] = [
  { kind: 'tab', name: 'Overview', mode: 'Structured', active: true, people: [SAMPLE_PEOPLE[0]!] },
  { kind: 'tab', name: 'Sketches', mode: 'Sketch' },
  { kind: 'folder', name: 'Planning', count: 2 },
  {
    kind: 'tab',
    name: 'Roadmap',
    mode: 'Plan',
    indent: true,
    people: [SAMPLE_PEOPLE[1]!, SAMPLE_PEOPLE[2]!],
  },
  { kind: 'tab', name: 'Retro', mode: 'Structured', indent: true },
  { kind: 'tab', name: 'Launch Deck', mode: 'Pages' },
];

/** The document group at the bottom right, and the tab list open above its tab stack: "Tabs" and the count, who is
 *  here, each tab with its mode glyph and who is on it, a folder heading over its tabs, the active tab tinted with its
 *  ⋯, and New Tab. */
export function TabListOverview() {
  const W = 520;
  const lineY = 266;
  const stack = tabStackCentre(W - 12);
  const listW = 230;
  const listH = tabListHeight(TAB_LIST_ROWS);
  const listX = Math.min(W - 12 - listW, Math.round(stack - listW / 2));
  return (
    <Scene w={W} h={310}>
      <Shape x={40} y={40} w={110} h={46} label="Checkout" />
      <TabList
        x={listX}
        y={lineY - 10 - listH}
        w={listW}
        rows={TAB_LIST_ROWS}
        count={5}
        peopleHere={3}
        arrowX={stack}
      />
      <DocumentGroup right={W - 12} y={lineY} count={5} stackOpen />
    </Scene>
  );
}

/** The tools group at the bottom left, the zoom presets open above its level: 25% to 150% and Fit to screen. */
export function ZoomControls() {
  const presets = ['25%', '50%', '75%', '100%', '125%', '150%'];
  const toolsX = 16;
  const levelX = toolsX + toolsGroupWidth({}) - 35;
  const px = levelX - 46;
  const py = 14;
  return (
    <Scene w={420} h={240}>
      <Shape x={270} y={60} w={110} h={52} label="Detail" />
      <Panel x={px} y={py} w={92} h={170}>
        {presets.map((p, i) => {
          const ry = py + 8 + i * 22;
          const on = p === '100%';
          return (
            <g key={p}>
              {on && (
                <rect x={px + 5} y={ry} width={82} height={20} rx={5} className="fill-brand-50" />
              )}
              <Label
                x={px + 46}
                y={ry + 11}
                size={10}
                weight={on ? 700 : 500}
                tone={on ? 'accent' : 'body'}
                anchor="middle"
              >
                {p}
              </Label>
            </g>
          );
        })}
        <line
          x1={px + 8}
          y1={py + 143}
          x2={px + 84}
          y2={py + 143}
          className="stroke-slate-200"
          strokeWidth={1.2}
        />
        <Label x={px + 46} y={py + 157} size={10} weight={500} tone="body" anchor="middle">
          Fit to screen
        </Label>
      </Panel>
      <ToolsGroup x={toolsX} y={196} />
    </Scene>
  );
}

/** One selected shape with its toolbar above: the "Selected Square" caption,
 *  then More, Add text, Duplicate, Bring to front, Send to back, Lock and
 *  Delete (an editor's toolbar; Add Comment is in the More menu). */
export function ContextualToolbar() {
  const tx = 92;
  const ty = 40;
  const buttons: ReactNode[] = [
    <DotsGlyph key="more" x={0} y={0} />,
    <path key="text" d="M-5 -5 h10 M0 -5 v10" {...GLYPH} />,
    <g key="dup">
      <rect x={-5} y={-5} width={8} height={8} rx={1.5} {...GLYPH} />
      <rect x={-2} y={-2} width={8} height={8} rx={1.5} {...GLYPH} />
    </g>,
    <path key="front" d="M0 5 V-5 M-4 -1 L0 -5 L4 -1" {...GLYPH} />,
    <path key="back" d="M0 -5 V5 M-4 1 L0 5 L4 1" {...GLYPH} />,
    <g key="lock">
      <rect x={-5} y={-1} width={10} height={7} rx={1.5} {...GLYPH} />
      <path d="M-3 -1 v-2 a3 3 0 0 1 6 0 v2" {...GLYPH} />
    </g>,
    <path key="delete" d="M-5 -4 h10 M-3 -4 v9 h6 v-9 M-1.5 -6 h3" {...GLYPH} />,
  ];
  return (
    <Scene w={420} h={210}>
      <Label x={tx + 2} y={ty - 10} size={10} weight={600} tone="muted">
        Selected Square
      </Label>
      <Panel x={tx} y={ty} w={8 + buttons.length * 30} h={34}>
        {buttons.map((g, i) => (
          <IconButton key={i} x={tx + 6 + i * 30} y={ty + 5}>
            {g}
          </IconButton>
        ))}
      </Panel>
      <Shape x={150} y={108} w={120} h={60} label="Checkout" />
      <SelectionBox x={150} y={108} w={120} h={60} />
    </Scene>
  );
}

/** A mixed marquee selection (two shapes and an arrow) with the multi-select
 *  toolbar: More, Filter Selection, Duplicate, Export, Lock and Delete. */
export function MultiSelectToolbar() {
  const tx = 116;
  const ty = 34;
  const buttons: ReactNode[] = [
    <DotsGlyph key="more" x={0} y={0} />,
    <path key="filter" d="M-6 -5 h12 l-5 5 v5 l-2 -1 v-4 Z" {...GLYPH} />,
    <g key="dup">
      <rect x={-5} y={-5} width={8} height={8} rx={1.5} {...GLYPH} />
      <rect x={-2} y={-2} width={8} height={8} rx={1.5} {...GLYPH} />
    </g>,
    <path key="export" d="M0 3 V-6 M-4 -2 L0 -6 L4 -2 M-6 3 v3 h12 v-3" {...GLYPH} />,
    <g key="lock">
      <rect x={-5} y={-1} width={10} height={7} rx={1.5} {...GLYPH} />
      <path d="M-3 -1 v-2 a3 3 0 0 1 6 0 v2" {...GLYPH} />
    </g>,
    <path key="delete" d="M-5 -4 h10 M-3 -4 v9 h6 v-9 M-1.5 -6 h3" {...GLYPH} />,
  ];
  return (
    <Scene w={420} h={220}>
      <Label x={tx + 2} y={ty - 10} size={10} weight={600} tone="muted">
        Selected Elements (3)
      </Label>
      <Panel x={tx} y={ty} w={8 + buttons.length * 30} h={34}>
        {buttons.map((g, i) => (
          <IconButton key={i} x={tx + 6 + i * 30} y={ty + 5}>
            {g}
          </IconButton>
        ))}
      </Panel>
      <Shape x={94} y={112} w={90} h={46} label="Cart" />
      <Shape x={250} y={112} w={90} h={46} accent label="Pay" />
      <Arrow from={[184, 135]} to={[250, 135]} />
      <SelectionBox x={86} y={102} w={262} h={66} />
    </Scene>
  );
}

/** The element menu for a shape: collapsible sections, Layer first, then
 *  Size, Shape, Rotation, the Style and Text flyouts, Collaborate and
 *  Resources. */
export function ElementContextMenu() {
  const sections: { label: string; flyout?: boolean }[] = [
    { label: 'Layer' },
    { label: 'Size' },
    { label: 'Shape' },
    { label: 'Rotation' },
    { label: 'Style', flyout: true },
    { label: 'Animation', flyout: true },
    { label: 'Text', flyout: true },
    { label: 'Collaborate' },
    { label: 'Resources' },
  ];
  const mx = 214;
  const my = 16;
  return (
    <Scene w={420} h={256}>
      <Shape x={56} y={60} w={112} h={56} accent label="Order" />
      <SelectionBox x={56} y={60} w={112} h={56} />
      <Panel x={mx} y={my} w={160} h={8 + sections.length * 25}>
        {sections.map((sec, i) => {
          const ry = my + 4 + i * 25;
          const on = sec.label === 'Style';
          return (
            <g key={sec.label}>
              {on && (
                <rect x={mx + 4} y={ry} width={152} height={23} rx={5} className="fill-brand-50" />
              )}
              <Label
                x={mx + 14}
                y={ry + 12}
                size={11}
                weight={on ? 600 : 500}
                tone={on ? 'accent' : 'body'}
              >
                {sec.label}
              </Label>
              <path
                d={
                  sec.flyout
                    ? `M${mx + 142} ${ry + 8} l4 4 l-4 4`
                    : `M${mx + 140} ${ry + 10} l4 4 l4 -4`
                }
                className="stroke-slate-400"
                strokeWidth={1.4}
                fill="none"
                strokeLinecap="round"
              />
            </g>
          );
        })}
      </Panel>
    </Scene>
  );
}

/** The bottom-left Map panel: a zoomed-out wireframe of the canvas, the area
 *  outside your view dimmed, and a brand rectangle marking what you see. */
export function Minimap() {
  return (
    <Scene w={420} h={210}>
      {/* The canvas the map mirrors. */}
      <Shape x={196} y={26} w={68} h={38} label="A" />
      <Shape x={176} y={116} w={62} h={36} accent label="B" />
      <Shape x={300} y={116} w={62} h={36} kind="circle" label="C" />
      {/* Elbow connectors down out of A, splitting to B and C, one level arrowhead each. */}
      <path
        d="M230 64 V88 H207 V108 M230 88 H331 V108"
        className="fill-none stroke-brand-400"
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <Arrow from={[207, 106]} to={[207, 116]} tone="accent" />
      <Arrow from={[331, 106]} to={[331, 116]} tone="accent" />
      {/* The Map panel, bottom-left, with the current-view box. */}
      <Panel x={20} y={110} w={136} h={88} title="MAP">
        <rect x={26} y={136} width={124} height={56} rx={4} className="fill-slate-100" />
        <rect x={52} y={146} width={70} height={40} rx={3} className="fill-white" />
        {/* The miniature in the shapes' own colours, labels left out. */}
        <rect
          x={80}
          y={150}
          width={20}
          height={10}
          rx={2}
          className="fill-white stroke-brand-300"
          strokeWidth={1}
        />
        <rect x={68} y={172} width={17} height={9} rx={2} className="fill-brand-500" />
        <circle cx={112} cy={176} r={5} className="fill-white stroke-brand-300" strokeWidth={1} />
        <path
          d="M90 160 V166 H76 V172 M90 166 H112 V171"
          className="fill-none stroke-brand-300"
          strokeWidth={1}
        />
        <rect
          x={52}
          y={146}
          width={70}
          height={40}
          rx={3}
          fill="none"
          className="stroke-brand-500"
          strokeWidth={1.6}
        />
      </Panel>
    </Scene>
  );
}
