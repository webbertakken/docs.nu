// Side by side tabs (docs/specs/007-editor/split-view.md, docs/specs/018-help/help-app.md): a tab's row
// dragged out of the tab list to the right edge with the drop ghost showing, and the open split, the
// editor's two lines in the pane being edited and the seam's two buttons.
// Composed only from the shared primitives so the house style holds.

import { Arrow, Cursor, Label, Scene, Shape } from './primitives';
import {
  ActionsGroup,
  BRAND_W,
  BrandGroup,
  DocumentGroup,
  MiniStrip,
  TabList,
  ToolsGroup,
  actionsGroupWidth,
  tabListHeight,
  tabStackCentre,
  type TabListRow,
} from './editor-lines';

const W = 440;
const H = 230;

/** The editor's two lines over a window `w` × `h` at (x, y), drawn at full size and scaled by `sc`, the way they sit
 *  in a pane: the brand group, the strip and the actions group along the top; the tools group and the document
 *  group along the bottom. */
function PaneLines({
  x,
  y,
  w,
  h,
  sc,
  tab,
  stackOpen = false,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  sc: number;
  tab: string;
  stackOpen?: boolean;
}) {
  const VW = w / sc;
  const VH = h / sc;
  const stripX = 12 + BRAND_W + 10;
  const stripW = VW - 12 - actionsGroupWidth({}) - 10 - stripX;
  return (
    <g transform={`translate(${x} ${y}) scale(${sc})`}>
      <BrandGroup x={12} y={12} />
      {stripW > 120 && <MiniStrip x={stripX} y={12} w={stripW} />}
      <ActionsGroup right={VW - 12} y={12} />
      <ToolsGroup x={12} y={VH - 44} />
      <DocumentGroup
        right={VW - 12}
        y={VH - 44}
        name="Launch"
        tab={tab}
        count={3}
        people={[]}
        stackOpen={stackOpen}
      />
    </g>
  );
}

/** Dragging a tab's row out of the tab list toward the right edge: the drop zone's ghost shows the pane it will
 *  open. */
export function SideBySideDrag() {
  const sc = 0.75;
  const VW = W / sc;
  const VH = H / sc;
  const ghostX = Math.round(W * 0.56);
  const groupProps = { name: 'Launch', tab: 'Plan', count: 3, people: [] };
  const stack = tabStackCentre(VW - 12, groupProps);
  const rows: TabListRow[] = [
    { kind: 'tab', name: 'Plan', active: true },
    { kind: 'tab', name: 'Timeline', mode: 'Plan' },
    { kind: 'tab', name: 'Budget' },
  ];
  const listW = 190;
  const listH = tabListHeight(rows);
  const listX = Math.min(VW - 12 - listW, Math.round(stack - listW / 2));
  const listY = VH - 54 - listH;
  const rowY = (listY + 30 + 22 + 11) * sc;
  return (
    <Scene w={W} h={H}>
      <Shape x={40} y={60} w={70} h={34} label="Goals" />
      <Shape x={40} y={122} w={70} h={34} label="Risks" />
      <Arrow from={[75, 94]} to={[75, 122]} tone="muted" width={1.5} />
      {/* The ghost of the pane, at the width it will open. */}
      <rect
        x={ghostX}
        y={40}
        width={W - ghostX - 6}
        height={H - 76}
        rx={8}
        className="fill-brand-50 stroke-brand-500"
        strokeWidth={2}
      />
      <Label x={ghostX + 12} y={55} size={9} weight={600} tone="accent">
        Open Timeline Side by Side
      </Label>
      <PaneLines x={0} y={0} w={W} h={H} sc={sc} tab="Plan" stackOpen />
      <g transform={`scale(${sc})`}>
        <TabList x={listX} y={listY} w={listW} rows={rows} count={3} arrowX={stack} />
      </g>
      <rect x={ghostX + 12} y={64} width={88} height={18} rx={9} className="fill-brand-600" />
      <Label x={ghostX + 56} y={74} size={8.5} weight={600} tone="onAccent" anchor="middle">
        Release to Open
      </Label>
      {/* The row on its way, under the pointer. */}
      <Arrow
        from={[(listX + 20) * sc, rowY]}
        to={[W - 34, 80]}
        kind="curved"
        tone="muted"
        dashed
        width={1.5}
      />
      <Cursor x={W - 30} y={76} />
    </Scene>
  );
}

/** The open split: the editor's two lines in the left pane (being edited), the other tab live on the right with
 *  its name chip, and the seam's Fit and Close buttons. */
export function SideBySideOpen() {
  const seam = W / 2;
  const top = 0;
  return (
    <Scene w={W} h={H}>
      {/* Left pane: the editor, with its two lines. */}
      <PaneLines x={0} y={0} w={seam} h={H} sc={0.42} tab="Plan" />
      <Shape x={80} y={top + 70} w={64} h={30} label="Goals" />
      <Shape x={120} y={top + 120} w={64} h={30} label="Risks" accent labelTone="onAccent" />
      {/* Right pane: the other tab, live, with its name chip. */}
      <rect x={seam} y={top} width={W - seam} height={H - top} className="fill-slate-50/60" />
      <rect
        x={seam + 10}
        y={top + 8}
        width={62}
        height={16}
        rx={8}
        className="fill-white stroke-slate-300"
      />
      <Label x={seam + 18} y={top + 19} size={8} weight={600} tone="strong">
        Timeline
      </Label>
      <Shape x={seam + 40} y={top + 70} w={60} h={28} label="Q1" />
      <Shape x={seam + 120} y={top + 70} w={60} h={28} label="Q2" />
      <Arrow from={[seam + 100, top + 84]} to={[seam + 120, top + 84]} tone="muted" width={1.5} />
      {/* The seam: the line, its two buttons, and the resize grip below them. */}
      <line x1={seam} y1={top} x2={seam} y2={H} className="stroke-slate-300" strokeWidth={1.2} />
      <rect
        x={seam - 8}
        y={top + 54}
        width={16}
        height={34}
        rx={8}
        className="fill-white stroke-slate-300"
      />
      <path
        d={`M${seam - 3.5} ${top + 62} h7 M${seam - 3.5} ${top + 62} v3 M${seam + 3.5} ${top + 62} v3`}
        className="stroke-slate-500"
        strokeWidth={1.2}
        fill="none"
      />
      <path
        d={`M${seam - 3} ${top + 76} l6 6 M${seam + 3} ${top + 76} l-6 6`}
        className="stroke-slate-500"
        strokeWidth={1.2}
      />
      <rect
        x={seam - 3}
        y={top + 96}
        width={6}
        height={20}
        rx={3}
        className="fill-white stroke-slate-300"
      />
      <Label x={seam + 12} y={H - 12} size={8.5} tone="muted">
        Click here to edit Timeline
      </Label>
    </Scene>
  );
}
