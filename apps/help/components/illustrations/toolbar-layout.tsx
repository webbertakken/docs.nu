// Scenes for the Toolbar Layout article (docs/specs/007-editor/toolbar-layout.md): the strip across the top
// of the canvas as the category bar, and a category's flyout opening under it. `Strip` and `MenuCard`
// are exported so other scenes draw the editor's top row the same way.
// Composed only from the shared primitives, like every other help scene.
import type { ReactNode } from 'react';
import { Label, Panel, Scene, Tile } from './primitives';
import { SelectGlyph } from './palette-modes-parts';
import { BrandGroup, DocumentGroup, ToolsGroup } from './editor-lines';

// The strip's element tiles, drawn as the simple outlines the real tiles use.
function ShapeGlyph({
  kind,
}: {
  kind:
    'square' | 'circle' | 'diamond' | 'text' | 'arrow' | 'cylinder' | 'parallelogram' | 'hexagon';
}) {
  const s = { className: 'stroke-slate-500', strokeWidth: 1.6, fill: 'none' } as const;
  switch (kind) {
    case 'square':
      return <rect x={-5} y={-5} width={10} height={10} rx={1.5} {...s} />;
    case 'circle':
      return <circle r={5.5} {...s} />;
    case 'diamond':
      return <path d="M0 -6 L6 0 L0 6 L-6 0 Z" {...s} />;
    case 'text':
      return <path d="M-5 -5 H5 M0 -5 V6" {...s} strokeLinecap="round" />;
    case 'arrow':
      return <path d="M-6 0 H5 M2 -3 L5 0 L2 3" {...s} strokeLinecap="round" />;
    case 'cylinder':
      return <path d="M-5 -4 a5 2 0 0 0 10 0 a5 2 0 0 0 -10 0 V4 a5 2 0 0 0 10 0 V-4" {...s} />;
    case 'parallelogram':
      return <path d="M-3 -5 H6 L3 5 H-6 Z" {...s} strokeLinejoin="round" />;
    case 'hexagon':
      return <path d="M-3 -5 H3 L6 0 L3 5 H-3 L-6 0 Z" {...s} strokeLinejoin="round" />;
  }
}

// A pill-shaped dropdown in the strip: tinted, so it reads as a menu beside
// the plain tiles, the way the real strip draws its selection mode, category
// and More controls.
function Pill({
  x,
  y,
  w,
  active = false,
  children,
}: {
  x: number;
  y: number;
  w: number;
  active?: boolean;
  children: ReactNode;
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={24}
        rx={6}
        className={active ? 'fill-brand-100 stroke-brand-300' : 'fill-brand-50 stroke-brand-100'}
        strokeWidth={1}
      />
      {children}
      <path
        d={`M${x + w - 12} ${y + 10} l3 3 l3 -3`}
        className="stroke-brand-600"
        strokeWidth={1.4}
        fill="none"
        strokeLinecap="round"
      />
    </g>
  );
}

// The category bar (Workshop, Pages), in order: category names, and '|' for the divider between the bands.
const BAR: readonly string[] = [
  'Shapes',
  'Draw',
  '|',
  'Build',
  'Concepts',
  '|',
  'Icons',
  'Tech',
  'Media',
];
// A name's width at the strip's 8.5px type, and the padding either side of it. Tight enough that the whole
// strip, Search included, fits a 420-wide scene beside the menu card (the figure scan in help-pages.md).
const charW = 4.5;
const PAD = 5;
const nameW = (name: string) => Math.round(name.length * charW + 2 * PAD);

/** The width of the strip drawn by `Strip`. */
export const STRIP_W = 49 + BAR.reduce((w, c) => w + (c === '|' ? 9 : nameW(c)), 0) + 36;

/** The palette strip as the category bar (Workshop, Pages), top-left corner at (x, y), STRIP_W wide and 32 tall:
 *  the selection mode, the categories by name (`open` pressed, its flyout showing), and Search. */
export function Strip({ x, y, open }: { x: number; y: number; open?: string }) {
  const slots = barSlots(x);
  const end = slots.at(-1)!.left + slots.at(-1)!.w;
  const items = slots.map((slot, i) => {
    if (slot.name === '|')
      return (
        <path
          key={i}
          d={`M${slot.left + 4} ${y + 8}v16`}
          className="stroke-slate-200"
          strokeWidth={1}
        />
      );
    const { name, left: at, w } = slot;
    const pressed = name === open;
    return (
      <g key={name}>
        {pressed ? (
          <rect x={at} y={y + 4} width={w} height={24} rx={6} className="fill-brand-100" />
        ) : null}
        <Label
          x={at + w / 2}
          y={y + 19}
          size={8.5}
          weight={pressed ? 700 : 500}
          anchor="middle"
          className={pressed ? 'fill-brand-700' : 'fill-slate-600'}
        >
          {name}
        </Label>
        {pressed ? (
          <rect x={at + 6} y={y + 27} width={w - 12} height={2} rx={1} className="fill-brand-500" />
        ) : null}
      </g>
    );
  });

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={STRIP_W}
        height={32}
        rx={9}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      <Pill x={x + 4} y={y + 4} w={34}>
        <g transform={`translate(${x + 15} ${y + 16}) scale(0.8)`}>
          <SelectGlyph />
        </g>
      </Pill>
      <path d={`M${x + 43} ${y + 8}v16`} className="stroke-slate-200" strokeWidth={1} />
      {items}
      {/* Search, last on the strip behind its own divider. */}
      <path d={`M${end + 5} ${y + 8}v16`} className="stroke-slate-200" strokeWidth={1} />
      <circle
        cx={end + 19}
        cy={y + 15}
        r={5}
        className="fill-none stroke-slate-500"
        strokeWidth={1.6}
      />
      <path
        d={`M${end + 23} ${y + 19} l4 4`}
        className="stroke-slate-500"
        strokeWidth={1.6}
        strokeLinecap="round"
      />
    </g>
  );
}

// Each of the bar's items on a strip drawn at x: its left edge and width (a divider is 9 wide).
function barSlots(x: number): { name: string; left: number; w: number }[] {
  return BAR.reduce<{ name: string; left: number; w: number }[]>((out, name) => {
    const prev = out.at(-1);
    const left = prev ? prev.left + prev.w : x + 49;
    return [...out, { name, left, w: name === '|' ? 9 : nameW(name) }];
  }, []);
}

/** Where a category's button sits on a strip drawn at x: its left edge and width. */
export function stripCategory(x: number, name: string): { left: number; w: number } {
  const slot = barSlots(x).find((s) => s.name === name);
  return slot ? { left: slot.left, w: slot.w } : { left: x, w: 0 };
}

/** The brand group at the top left, its top-left corner at (x, y): Back, the menu button and the mode switch
 *  (editor-lines.tsx). Named so the strip's scenes read as they always did. */
export function MenuCard({ x, y }: { x: number; y: number }) {
  return <BrandGroup x={x} y={y} />;
}

/** The editor's two lines, reduced to what this article is about: the brand group top-left and the strip across the
 *  top (ending in Search); the tools group bottom-left and the document group bottom-right. */
export function ToolbarLayoutOverview() {
  const leader = { className: 'stroke-slate-300', strokeWidth: 1 } as const;
  return (
    <Scene w={420} h={200}>
      <MenuCard x={8} y={16} />
      <Strip x={78} y={16} />
      {/* Two rows of labels: side by side, neighbouring labels ran into each other. The lower row
          hangs from its control on a thin leader through the gap in the row above. */}
      <Label x={10} y={62} size={10} tone="muted">
        Back, Explorer, mode
      </Label>
      <line x1={99} y1={51} x2={99} y2={70} {...leader} />
      <Label x={99} y={80} size={10} anchor="middle" tone="muted">
        Selection mode
      </Label>
      <line x1={250} y1={51} x2={250} y2={70} {...leader} />
      <Label x={250} y={80} size={10} anchor="middle" tone="accent" weight={700}>
        Categories
      </Label>
      <line x1={78 + STRIP_W - 18} y1={51} x2={78 + STRIP_W - 18} y2={70} {...leader} />
      <Label x={78 + STRIP_W - 18} y={80} size={10} anchor="middle" tone="muted">
        Search
      </Label>
      {/* The bottom line: the tools group at the left, the document group at the right. */}
      <ToolsGroup x={8} y={158} />
      <DocumentGroup
        right={412}
        y={158}
        name={null}
        role={false}
        tab="Tab 1"
        count={2}
        people={[]}
      />
    </Scene>
  );
}

/** A category open: resting on Shapes hangs its flyout under it, its tiles in named groups. */
export function ToolbarCategoryFlyout() {
  const groups = [
    { title: 'Basics', tiles: ['square', 'circle', 'diamond'] as const },
    { title: 'Flowchart', tiles: ['cylinder', 'parallelogram', 'hexagon'] as const },
  ];
  const shapes = stripCategory(78, 'Shapes');
  const panelX = Math.round(shapes.left + shapes.w / 2 - 90);
  return (
    <Scene w={420} h={236}>
      <MenuCard x={8} y={16} />
      <Strip x={78} y={16} open="Shapes" />
      <Panel x={panelX} y={58} w={180} h={166} title="SHAPES">
        {groups.map((g, gi) => (
          <g key={g.title}>
            <Label x={panelX + 10} y={96 + gi * 60} size={9} weight={600} tone="muted">
              {g.title}
            </Label>
            {g.tiles.map((kind, i) => (
              <Tile key={kind} x={panelX + 10 + i * 54} y={102 + gi * 60} size={34}>
                <ShapeGlyph kind={kind} />
              </Tile>
            ))}
          </g>
        ))}
      </Panel>
    </Scene>
  );
}
