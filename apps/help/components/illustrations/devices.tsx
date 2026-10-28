// Supported-devices illustrations (docs/specs/018-help/help-app.md): the editor framed inside a desktop
// monitor, a tablet, and a phone, each with the chrome that screen size brings
// (the two lines on desktop and tablet, wrapped to the width on a phone). Composed only
// from the shared primitives so the house style holds.

import { type ReactNode } from 'react';

import { Scene, Shape, Arrow, Panel, Label } from './primitives';
import {
  ActionsGroup,
  BRAND_W,
  BrandGroup,
  DocumentGroup,
  MiniStrip,
  ToolsGroup,
  actionsGroupWidth,
} from './editor-lines';

// A tiny stand-in flow drawn at any origin / scale, so the same diagram can sit
// inside a roomy monitor or a cramped phone without redrawing it per frame.
function MiniFlow({
  x,
  y,
  s = 1,
  showLabels = true,
}: {
  x: number;
  y: number;
  s?: number;
  showLabels?: boolean;
}) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <Shape x={0} y={20} w={70} h={36} kind="rect" label={showLabels ? 'Start' : undefined} />
      <Shape x={110} y={20} w={64} h={36} kind="diamond" />
      <Shape
        x={110}
        y={84}
        w={70}
        h={34}
        kind="rect"
        accent
        label={showLabels ? 'Done' : undefined}
      />
      <Arrow from={[70, 38]} to={[110, 38]} />
      <Arrow from={[142, 56]} to={[142, 84]} />
    </g>
  );
}

/** The editor's two lines in miniature inside a screen `w` × `h` at (x, y), drawn at full size and scaled by
 *  `s`: the brand group, the Palette strip and the actions group along the top; the tools group and the
 *  document group along the bottom. On a `phone` the strip takes its own row under the top line, the document
 *  group has no name and wraps above the tools group, and the zoom is Fit alone. */
function ScreenLines({
  x,
  y,
  w,
  h,
  s,
  phone = false,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  s: number;
  phone?: boolean;
}) {
  const W = w / s;
  const H = h / s;
  const actionsW = actionsGroupWidth({});
  const stripX = 12 + BRAND_W + 10;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <BrandGroup x={12} y={12} named={!phone} />
      <ActionsGroup right={W - 12} y={12} />
      {phone ? (
        <MiniStrip x={12} y={52} w={W - 24} />
      ) : (
        <MiniStrip x={stripX + 44} y={12} w={W - 12 - actionsW - 10 - stripX - 44} />
      )}
      {phone ? (
        <>
          <DocumentGroup right={W - 12} y={H - 84} name={null} role={false} />
          <ToolsGroup x={12} y={H - 44} />
        </>
      ) : (
        <>
          <ToolsGroup x={12} y={H - 44} />
          <DocumentGroup right={W - 12} y={H - 44} />
        </>
      )}
    </g>
  );
}

// --- Desktop -----------------------------------------------------------------

/** A monitor showing the full editor: the two lines over the diagram. */
export function DesktopEditor() {
  return (
    <Scene w={420} h={240} bg="plain">
      {/* Monitor bezel + screen */}
      <rect
        x={20}
        y={16}
        width={380}
        height={188}
        rx={10}
        className="fill-white stroke-slate-300"
        strokeWidth={3}
      />
      <rect x={30} y={26} width={360} height={168} rx={4} className="fill-slate-50" />
      {/* Diagram on the canvas */}
      <g transform="translate(48 50) scale(0.92)">
        <MiniFlow x={0} y={0} />
      </g>
      {/* The two lines: the brand group, the strip and the actions group along the top; the tools group and
          the document group along the bottom. */}
      <ScreenLines x={30} y={26} w={360} h={168} s={0.5} />
      {/* Monitor stand */}
      <rect x={196} y={204} width={28} height={16} className="fill-slate-200" />
      <rect x={166} y={220} width={88} height={7} rx={3.5} className="fill-slate-300" />
    </Scene>
  );
}

/** A keyboard with a few editor shortcuts called out, the desktop-only fast path. */
export function DesktopShortcuts() {
  const keys: { label: string; sub: string }[] = [
    { label: '⌘Z', sub: 'Undo' },
    { label: '⌘C', sub: 'Copy' },
    { label: '⌘D', sub: 'Duplicate' },
    { label: 'Shift', sub: 'Resize lock' },
  ];
  return (
    <Scene w={420} h={170} bg="plain">
      <Panel x={48} y={30} w={324} h={108}>
        <Label x={64} y={52} size={10} weight={700} tone="muted">
          KEYBOARD SHORTCUTS
        </Label>
        {keys.map((k, i) => {
          const kx = 64 + i * 78;
          return (
            <g key={i}>
              <rect
                x={kx}
                y={66}
                width={62}
                height={34}
                rx={7}
                className="fill-slate-50 stroke-slate-300"
                strokeWidth={1.5}
              />
              <Label x={kx + 31} y={84} anchor="middle" size={11} weight={700} tone="accent">
                {k.label}
              </Label>
              <Label x={kx + 31} y={114} anchor="middle" size={9} tone="muted">
                {k.sub}
              </Label>
            </g>
          );
        })}
      </Panel>
    </Scene>
  );
}

// --- Tablet ------------------------------------------------------------------

/** A tablet held in landscape: the roomy screen gets the full layout, the same as a
 *  computer. */
export function TabletLandscape() {
  return (
    <Scene w={420} h={220} bg="plain">
      {/* Tablet body (wide) */}
      <rect
        x={26}
        y={24}
        width={368}
        height={172}
        rx={16}
        className="fill-white stroke-slate-300"
        strokeWidth={3}
      />
      <circle cx={40} cy={110} r={3} className="fill-slate-300" />
      <rect x={52} y={36} width={330} height={148} rx={6} className="fill-slate-50" />
      {/* Diagram */}
      <g transform="translate(70 56) scale(0.92)">
        <MiniFlow x={0} y={0} />
      </g>
      {/* The two lines, like desktop */}
      <ScreenLines x={52} y={36} w={330} h={148} s={0.46} />
      <Label x={210} y={210} anchor="middle" size={10} weight={600} tone="muted">
        Full layout, as on a computer
      </Label>
    </Scene>
  );
}

// --- Mobile ------------------------------------------------------------------

/** A phone running the touch editor: the two lines wrapped to its width, the diagram opened zoomed out, and a
 *  finger interacting with the canvas. */
export function MobileEditor() {
  return (
    <Scene w={420} h={240} bg="plain">
      {/* Phone body */}
      <rect
        x={150}
        y={14}
        width={120}
        height={212}
        rx={20}
        className="fill-white stroke-slate-300"
        strokeWidth={3}
      />
      <rect x={188} y={22} width={44} height={5} rx={2.5} className="fill-slate-200" />
      <rect x={158} y={34} width={104} height={172} rx={6} className="fill-slate-50" />
      {/* The two lines, wrapped to the phone's width (docs/specs/007-editor/toolbar-layout.md "On a phone"):
          the brand group and the actions group, the strip on its own row under them; the document group (no
          name) above the tools group. */}
      <ScreenLines x={158} y={34} w={104} h={172} s={0.25} phone />
      {/* Diagram, opened zoomed out */}
      <g transform="translate(164 78) scale(0.5)">
        <MiniFlow x={0} y={0} showLabels={false} />
      </g>
      {/* Home indicator */}
      <rect x={194} y={214} width={32} height={4} rx={2} className="fill-slate-300" />
      {/* Touch finger / tap ring on the canvas */}
      <g transform="translate(196 150)">
        <circle r={14} className="fill-brand-500/15 stroke-brand-400" strokeWidth={2} />
        <circle r={5} className="fill-brand-500" />
      </g>
    </Scene>
  );
}

/** The four touch gestures: pinch to zoom, drag to pan, tap to select, and
 *  press-and-hold for the menu. */
export function TouchGestures() {
  const tiles: { title: string; glyph: ReactNode }[] = [
    {
      title: 'Pinch',
      glyph: (
        <g>
          {/* Two fingertips moving apart along a diagonal. */}
          <circle cx={-4} cy={4} r={3} className="fill-brand-500" />
          <circle cx={4} cy={-4} r={3} className="fill-brand-500" />
          <path
            d="M-8 8 L-12 12 M-12 7 V12 H-7 M8 -8 L12 -12 M7 -12 H12 V-7"
            className="fill-none stroke-brand-500"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      ),
    },
    {
      title: 'Drag',
      glyph: (
        <g>
          <path
            d="M-10 0 H10 M6 -4 l4 4 -4 4 M-6 -4 l-4 4 4 4"
            className="stroke-brand-500"
            strokeWidth={2}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      ),
    },
    {
      title: 'Tap',
      glyph: (
        <g>
          <circle r={9} className="fill-none stroke-brand-300" strokeWidth={2} />
          <circle r={4} className="fill-brand-500" />
        </g>
      ),
    },
    {
      title: 'Hold',
      glyph: (
        <g>
          <circle r={9} className="fill-brand-500/15 stroke-brand-400" strokeWidth={2} />
          <circle r={4} className="fill-brand-500" />
        </g>
      ),
    },
  ];
  return (
    <Scene w={420} h={134} bg="plain">
      {tiles.map((t, i) => {
        const tx = 28 + i * 98;
        return (
          <g key={i}>
            <rect
              x={tx}
              y={26}
              width={82}
              height={82}
              rx={12}
              className="fill-white stroke-slate-200"
              strokeWidth={2}
            />
            <g transform={`translate(${tx + 41} 58)`}>{t.glyph}</g>
            <Label x={tx + 41} y={92} anchor="middle" size={10} weight={600} tone="body">
              {t.title}
            </Label>
          </g>
        );
      })}
    </Scene>
  );
}
