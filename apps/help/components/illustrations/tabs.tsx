// Tabs-category illustrations (docs/specs/018-help/help-app.md): the document group at the bottom right
// (chrome/lines/DocumentGroup), tab folders in the tab list, the tab menu (toolbar over full-width rows split into groups),
// the Add to Folder / Add to Document / Import / Export dialogs, cross-tab links, a locked tab,
// and a before/after cleanup. Labels are the editor's own (TabPortalMenu,
// TabOrganiseDialogs, ImportTabDialog, ExportTabDialog).
// Composed only from the shared primitives so the house style holds.

import type { ReactNode } from 'react';
import { Scene, Shape, Arrow, Label, Dialog, Cursor } from './primitives';
import { Glyph } from './element-indicators';
import {
  DocumentGroup,
  SAMPLE_PEOPLE,
  TabList,
  tabListHeight,
  tabStackCentre,
  type TabListRow,
} from './editor-lines';

const TWO_PEOPLE = SAMPLE_PEOPLE.slice(0, 2);

// --- Building blocks ---------------------------------------------------------

/** A small padlock glyph drawn from its centre (the locked-tab marker). */
function Padlock({ tone = 'accent' }: { tone?: 'accent' | 'muted' }) {
  const fill = tone === 'accent' ? 'fill-brand-600' : 'fill-slate-500';
  const stroke = tone === 'accent' ? 'stroke-brand-600' : 'stroke-slate-500';
  return (
    <g>
      <rect x={-4.5} y={-1} width={9} height={7} rx={1.5} className={fill} />
      <path
        d="M-2.8 -1 V-3.2 a2.8 2.8 0 0 1 5.6 0 V-1"
        fill="none"
        className={stroke}
        strokeWidth={1.5}
      />
    </g>
  );
}

/** A folder glyph drawn from its centre: closed while the fan is tucked away, open while it shows. */
function FolderIcon({ open = false }: { open?: boolean }) {
  if (open) {
    return (
      <g>
        <path
          d="M-8 -5 h5 l2 2 h7 v2 h-14 Z"
          className="fill-slate-200 stroke-slate-500"
          strokeWidth={1.4}
          strokeLinejoin="round"
        />
        <path
          d="M-8 -1 h17 l-2 6.5 h-15 Z"
          className="fill-white stroke-slate-500"
          strokeWidth={1.4}
          strokeLinejoin="round"
        />
      </g>
    );
  }
  return (
    <path
      d="M-8 -5 h5 l2 2 h8 a1 1 0 0 1 1 1 v7 a1 1 0 0 1 -1 1 h-14 a1 1 0 0 1 -1 -1 v-9 a1 1 0 0 1 1 -1 Z"
      className="fill-slate-200 stroke-slate-500"
      strokeWidth={1.4}
      strokeLinejoin="round"
    />
  );
}

/** A tile in a dialog grid: an icon well, a label and an optional sub-line. */
function PickTile({
  x,
  y,
  w = 80,
  h = 64,
  label,
  sub,
  selected = false,
  dashed = false,
  children,
}: {
  x: number;
  y: number;
  w?: number;
  h?: number;
  label: string;
  sub?: string;
  selected?: boolean;
  dashed?: boolean;
  children?: ReactNode;
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={8}
        className={selected ? 'fill-brand-50 stroke-brand-400' : 'fill-white stroke-slate-200'}
        strokeWidth={1.5}
        strokeDasharray={dashed ? '4 3' : undefined}
      />
      {children && <g transform={`translate(${x + w / 2} ${y + 18})`}>{children}</g>}
      <Label
        x={x + w / 2}
        y={y + 38}
        anchor="middle"
        size={10}
        weight={600}
        tone={selected ? 'accent' : 'strong'}
      >
        {label}
      </Label>
      {sub && (
        <Label x={x + w / 2} y={y + 52} anchor="middle" size={10} tone="muted">
          {sub}
        </Label>
      )}
    </g>
  );
}

/** A format card in the Import / Export dialogs: a small file badge and the format name. */
function FormatCard({
  x,
  y,
  w = 98,
  title,
  badge,
}: {
  x: number;
  y: number;
  w?: number;
  title: string;
  badge: string;
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={34}
        rx={7}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      <rect
        x={x + 6}
        y={y + 9}
        width={36}
        height={16}
        rx={2}
        className="fill-none stroke-slate-300"
        strokeWidth={1.2}
      />
      <Label x={x + 24} y={y + 18} anchor="middle" size={10} weight={600} tone="body">
        {badge}
      </Label>
      <Label x={x + 48} y={y + 18} size={11} weight={700} tone="strong">
        {title}
      </Label>
    </g>
  );
}

// --- Scenes ------------------------------------------------------------------

/** The document group at the bottom right: the active tab with its ⋯, the tab stack with the count, the people
 *  here and the + button, under the active tab's canvas. */
export function TabBarOverview() {
  return (
    <Scene w={420} h={210}>
      {/* The active tab's canvas */}
      <Shape x={64} y={44} w={92} h={44} kind="rect" accent label="Overview" />
      <Shape x={236} y={16} w={80} h={40} kind="rect" label="API" />
      <Shape x={236} y={80} w={80} h={40} kind="rect" label="Web" />
      <Arrow from={[156, 66]} to={[236, 36]} kind="elbow" tone="muted" />
      <Arrow from={[156, 66]} to={[236, 100]} kind="elbow" tone="muted" />
      <DocumentGroup right={408} y={166} count={4} people={TWO_PEOPLE} />
    </Scene>
  );
}

/** Renaming the active tab in place: its name a field, ringed, with a text caret. */
export function RenamingTab() {
  return (
    <Scene w={420} h={130} bg="plain">
      <Label x={408} y={52} size={10} tone="muted" anchor="end">
        Click the active tab&apos;s name, Enter to save
      </Label>
      <DocumentGroup right={408} y={70} tab="Payments" count={3} people={TWO_PEOPLE} renaming />
    </Scene>
  );
}

/** The tab menu's full-width rows, in groups parted by a hairline: one entry per row, `null` for
 *  a separator. `highlight` tints one row as if under the pointer. */
function MenuRowList({
  x,
  y,
  w,
  rows,
  highlight,
}: {
  x: number;
  y: number;
  w: number;
  rows: (string | null)[];
  highlight?: string;
}) {
  let cy = y;
  const out: ReactNode[] = [];
  rows.forEach((r, i) => {
    if (r === null) {
      out.push(
        <line
          key={`sep-${i}`}
          x1={x}
          y1={cy + 4}
          x2={x + w}
          y2={cy + 4}
          className="stroke-slate-200"
          strokeWidth={1}
        />,
      );
      cy += 8;
      return;
    }
    const on = r === highlight;
    out.push(
      <g key={r}>
        {on ? (
          <rect x={x + 4} y={cy} width={w - 8} height={18} rx={4} className="fill-brand-50" />
        ) : null}
        <rect
          x={x + 12}
          y={cy + 5}
          width={8}
          height={8}
          rx={2}
          className={on ? 'fill-none stroke-brand-500' : 'fill-none stroke-slate-300'}
          strokeWidth={1.2}
        />
        <Label
          x={x + 28}
          y={cy + 9.5}
          size={10}
          weight={on ? 600 : 400}
          tone={on ? 'accent' : 'body'}
        >
          {r}
        </Label>
      </g>,
    );
    cy += 18;
  });
  return <g>{out}</g>;
}

/** The tab menu: the quick-action toolbar (Rename, Duplicate, Paste, Lock Tab, Delete) over
 *  full-width rows in two groups (folders and documents, content), opened from the
 *  active tab's ⋯ button. */
export function TabMenu() {
  const barY = 178;
  const mx = 150;
  const my = 10;
  const mw = 200;
  const rows = ['Add to Folder', 'Add to Document', null, 'Import', 'Export', 'Clear'];
  return (
    <Scene w={420} h={230}>
      <DocumentGroup right={408} y={barY} count={3} people={TWO_PEOPLE} />
      {/* The menu, right-aligned above the ⋯ button */}
      <rect
        x={mx}
        y={my}
        width={mw}
        height={152}
        rx={8}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      {/* Toolbar: Rename, Duplicate, Paste, Side by Side | Lock Tab, Delete */}
      {[0, 1, 2, 3].map((i) => (
        <rect
          key={i}
          x={mx + 8 + i * 30}
          y={my + 8}
          width={24}
          height={24}
          rx={5}
          className="fill-slate-50 stroke-slate-200"
          strokeWidth={1}
        />
      ))}
      {/* Rename (pencil) */}
      <path
        d={`M${mx + 15} ${my + 26} l2 -5 l7 -7 l3 3 l-7 7 Z`}
        className="fill-none stroke-slate-500"
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
      {/* Duplicate (two squares) */}
      <rect
        x={mx + 44}
        y={my + 13}
        width={10}
        height={10}
        rx={2}
        className="fill-none stroke-slate-500"
        strokeWidth={1.4}
      />
      <rect
        x={mx + 48}
        y={my + 17}
        width={10}
        height={10}
        rx={2}
        className="fill-white stroke-slate-500"
        strokeWidth={1.4}
      />
      {/* Paste (clipboard) */}
      <rect
        x={mx + 75}
        y={my + 13}
        width={12}
        height={14}
        rx={2}
        className="fill-none stroke-slate-500"
        strokeWidth={1.4}
      />
      <rect
        x={mx + 78}
        y={my + 11}
        width={6}
        height={4}
        rx={1}
        className="fill-white stroke-slate-500"
        strokeWidth={1.2}
      />
      {/* Side by Side (two panes) */}
      <rect
        x={mx + 103}
        y={my + 14}
        width={14}
        height={12}
        rx={2}
        className="fill-none stroke-slate-500"
        strokeWidth={1.4}
      />
      <line
        x1={mx + 110}
        y1={my + 14}
        x2={mx + 110}
        y2={my + 26}
        className="stroke-slate-500"
        strokeWidth={1.4}
      />
      {/* Lock Tab + Delete at the right edge */}
      <rect
        x={mx + mw - 62}
        y={my + 8}
        width={24}
        height={24}
        rx={5}
        className="fill-slate-50 stroke-slate-200"
        strokeWidth={1}
      />
      <g transform={`translate(${mx + mw - 50} ${my + 21})`}>
        <Padlock tone="muted" />
      </g>
      <rect
        x={mx + mw - 32}
        y={my + 8}
        width={24}
        height={24}
        rx={5}
        className="fill-slate-50 stroke-slate-200"
        strokeWidth={1}
      />
      <path
        d={`M${mx + mw - 26} ${my + 15} h12 M${mx + mw - 23} ${my + 15} v11 h6 v-11 M${mx + mw - 22} ${my + 15} v-2 h4 v2`}
        className="fill-none stroke-rose-500"
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
      <line
        x1={mx}
        y1={my + 40}
        x2={mx + mw}
        y2={my + 40}
        className="stroke-slate-200"
        strokeWidth={1.5}
      />
      <MenuRowList x={mx} y={my + 46} w={mw} rows={rows} />
      <Label x={14} y={30} size={10} tone="muted">
        Rename, Duplicate,
      </Label>
      <Label x={14} y={44} size={10} tone="muted">
        Paste, Side by Side,
      </Label>
      <Label x={14} y={58} size={10} tone="muted">
        then Lock Tab, Delete
      </Label>
    </Scene>
  );
}

/** A tab folder in the tab list: the Plans heading with its count, its tabs indented under it (the active one
 *  tinted), and a loose tab above it. */
export function TabFolderStates() {
  const rows: TabListRow[] = [
    { kind: 'tab', name: 'Notes' },
    { kind: 'folder', name: 'Plans', count: 3 },
    { kind: 'tab', name: 'Q1 plan', indent: true, active: true },
    { kind: 'tab', name: 'Q2 plan', indent: true },
    { kind: 'tab', name: 'Q3 plan', indent: true },
  ];
  const lineY = 230;
  const groupProps = { tab: 'Q1 plan', count: 4, people: [] };
  const stack = tabStackCentre(408, groupProps);
  const listW = 200;
  const listH = tabListHeight(rows);
  return (
    <Scene w={420} h={274}>
      <TabList
        x={Math.min(408 - listW, Math.round(stack - listW / 2))}
        y={lineY - 10 - listH}
        w={listW}
        rows={rows}
        count={4}
        arrowX={stack}
      />
      <DocumentGroup right={408} y={lineY} {...groupProps} stackOpen />
    </Scene>
  );
}

/** The Add to Folder dialog: a No Folder tile, a tile per folder, and a New Folder tile. */
export function AddToFolderMenu() {
  const W = 420;
  const H = 210;
  const dx = 20;
  const dy = 18;
  return (
    <Scene w={W} h={H}>
      <Dialog x={dx} y={dy} w={380} h={174} title="Add to Folder" sceneW={W} sceneH={H}>
        <Label x={dx + 16} y={dy + 48} size={10} tone="muted">
          File this tab into a folder on the tab bar.
        </Label>
        <Label x={dx + 16} y={dy + 61} size={10} tone="muted">
          Same name means same folder.
        </Label>
        <PickTile x={dx + 16} y={dy + 78} w={84} label="No Folder" sub="Loose on the bar">
          <FolderIcon />
          <path d="M-3 -2 l6 6 M3 -2 l-6 6" className="stroke-slate-500" strokeWidth={1.3} />
        </PickTile>
        <PickTile x={dx + 104} y={dy + 78} w={84} label="Plans" sub="Current" selected>
          <FolderIcon />
        </PickTile>
        <PickTile x={dx + 192} y={dy + 78} w={84} label="Back office" sub="Folder">
          <FolderIcon />
        </PickTile>
        <PickTile x={dx + 280} y={dy + 78} w={84} label="New Folder" sub="Create here" dashed>
          <path
            d="M-6 0 h12 M0 -6 v12"
            className="stroke-slate-500"
            strokeWidth={1.6}
            strokeLinecap="round"
          />
        </PickTile>
      </Dialog>
    </Scene>
  );
}

/** A link on one tab jumping to another: the element's Follow link badge, its hover card naming
 *  the destination, and the target tab in the bar. */
export function CrossTabLink() {
  const barY = 158;
  return (
    <Scene w={420} h={210}>
      {/* Source element with its link indicator along the top, under the pointer */}
      <Shape x={30} y={58} w={104} h={52} kind="rect" label="Database" />
      <Glyph kind="link" cx={120} cy={70} strength={1} />
      <Cursor x={122} y={74} />
      {/* The badge's hover card */}
      <rect
        x={70}
        y={8}
        width={170}
        height={34}
        rx={7}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      <Label x={80} y={19} size={10} weight={700} tone="strong">
        Follow link
      </Label>
      <Label x={80} y={33} size={10} tone="muted">
        Goes to tab &quot;DB internals&quot;
      </Label>

      {/* The jump */}
      <Arrow from={[140, 84]} to={[252, 84]} kind="curved" />

      {/* The target tab's content */}
      <Shape x={258} y={58} w={120} h={52} kind="rect" accent label="DB internals" />

      <DocumentGroup right={408} y={barY + 4} tab="DB internals" count={3} people={[]} />
    </Scene>
  );
}

/** The Add to Document dialog: a filter box over a grid of your other documents. */
export function AddToDocumentMenu() {
  const W = 420;
  const H = 210;
  const dx = 30;
  const dy = 14;
  const docs = ['Roadmap 2026', 'Onboarding', 'Architecture'];
  return (
    <Scene w={W} h={H}>
      <Dialog x={dx} y={dy} w={360} h={182} title="Add to Document" sceneW={W} sceneH={H}>
        <rect
          x={dx + 16}
          y={dy + 48}
          width={328}
          height={24}
          rx={6}
          className="fill-white stroke-slate-200"
          strokeWidth={1.5}
        />
        <Label x={dx + 26} y={dy + 61} size={11} tone="muted">
          Filter documents…
        </Label>
        {docs.map((d, i) => {
          const tx = dx + 16 + i * 112;
          const ty = dy + 84;
          return (
            <g key={d}>
              <rect
                x={tx}
                y={ty}
                width={104}
                height={84}
                rx={8}
                className={
                  i === 2 ? 'fill-brand-50 stroke-brand-400' : 'fill-white stroke-slate-200'
                }
                strokeWidth={1.5}
              />
              {/* The destination's snapshot thumbnail */}
              <rect
                x={tx + 8}
                y={ty + 8}
                width={88}
                height={48}
                rx={4}
                className="fill-slate-50 stroke-slate-200"
                strokeWidth={1}
              />
              <rect
                x={tx + 18}
                y={ty + 18}
                width={24}
                height={14}
                rx={3}
                className="fill-brand-200"
              />
              <rect
                x={tx + 58}
                y={ty + 30}
                width={26}
                height={16}
                rx={3}
                className="fill-brand-100 stroke-brand-300"
                strokeWidth={1}
              />
              <Label
                x={tx + 52}
                y={ty + 70}
                anchor="middle"
                size={10}
                weight={600}
                tone={i === 2 ? 'accent' : 'strong'}
              >
                {d}
              </Label>
            </g>
          );
        })}
      </Dialog>
    </Scene>
  );
}

/** The tab menu's rows, with Import under the pointer beside Export and Clear. */
export function ImportMenu() {
  const barY = 158;
  const mx = 150;
  const my = 14;
  return (
    <Scene w={420} h={210}>
      <DocumentGroup right={408} y={barY + 4} tab="Draft" count={3} people={TWO_PEOPLE} />
      <rect
        x={mx}
        y={my}
        width={192}
        height={110}
        rx={8}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      <MenuRowList
        x={mx}
        y={my + 6}
        w={192}
        rows={['Add to Folder', 'Add to Document', null, 'Import', 'Export', 'Clear']}
        highlight="Import"
      />
    </Scene>
  );
}

/** The Export Tab dialog: a card per format, text formats first, then the image formats. */
export function ExportMenu() {
  const W = 420;
  const H = 200;
  const dx = 20;
  const dy = 12;
  const cards: [string, string][] = [
    ['JSON', 'json'],
    ['Mermaid', 'mmd'],
    ['Markdown', 'md'],
    ['Excalidraw', 'excali'],
    ['PNG', 'png'],
    ['SVG', 'svg'],
    ['PDF', 'pdf'],
  ];
  return (
    <Scene w={W} h={H}>
      <Dialog x={dx} y={dy} w={380} h={176} title="Export Tab" sceneW={W} sceneH={H}>
        {cards.map(([title, badge], i) => (
          <FormatCard
            key={title}
            x={dx + 16 + (i % 3) * 118}
            y={dy + 50 + Math.floor(i / 3) * 40}
            w={112}
            title={title}
            badge={badge}
          />
        ))}
      </Dialog>
    </Scene>
  );
}

/** The Import to Tab dialog: the amber warning naming the tab about to be replaced, over the
 *  format cards. */
export function ImportWarning() {
  const W = 420;
  const H = 210;
  const dx = 20;
  const dy = 10;
  const cards: [string, string][] = [
    ['JSON', 'json'],
    ['Mermaid', 'mmd'],
    ['Markdown', 'md'],
    ['Excalidraw', 'excali'],
    ['draw.io', 'drawio'],
  ];
  return (
    <Scene w={W} h={H}>
      <Dialog x={dx} y={dy} w={380} h={190} title="Import to Tab" sceneW={W} sceneH={H}>
        {/* The amber warning banner */}
        <rect
          x={dx + 16}
          y={dy + 46}
          width={348}
          height={44}
          rx={7}
          className="fill-amber-50 stroke-amber-400"
          strokeWidth={1.2}
        />
        <g transform={`translate(${dx + 30} ${dy + 61})`}>
          <path
            d="M0 -7 L7.5 6 H-7.5 Z"
            className="fill-none stroke-amber-500"
            strokeWidth={1.6}
            strokeLinejoin="round"
          />
          <path
            d="M0 -2 v3.5"
            className="stroke-amber-500"
            strokeWidth={1.6}
            strokeLinecap="round"
          />
        </g>
        <Label x={dx + 44} y={dy + 60} size={10} className="fill-slate-700">
          This replaces everything on
        </Label>
        <Label x={dx + 185} y={dy + 60} size={10} weight={700} className="fill-slate-800">
          Draft
        </Label>
        <Label x={dx + 44} y={dy + 76} size={10} className="fill-slate-700">
          with the imported content. Undo brings it back.
        </Label>
        {cards.map(([title, badge], i) => (
          <FormatCard
            key={title}
            x={dx + 16 + (i % 3) * 118}
            y={dy + 100 + Math.floor(i / 3) * 40}
            w={112}
            title={title}
            badge={badge}
          />
        ))}
      </Dialog>
    </Scene>
  );
}

/** Before/after cleanup: scattered shapes on the left, snapped into tidy rows and columns on the
 *  right. */
export function CleanupBeforeAfter() {
  return (
    <Scene w={420} h={210}>
      <Label x={14} y={22} size={10} weight={700} tone="muted">
        BEFORE
      </Label>
      {/* Scattered, misaligned */}
      <Shape x={20} y={40} w={56} h={30} kind="rect" />
      <Shape x={108} y={64} w={56} h={30} kind="rect" />
      <Shape x={44} y={104} w={56} h={30} kind="rect" />
      <Shape x={128} y={132} w={56} h={30} kind="rect" />
      <Arrow from={[76, 55]} to={[108, 75]} tone="muted" />
      <Arrow from={[60, 70]} to={[60, 104]} tone="muted" />
      <Arrow from={[142, 94]} to={[152, 132]} tone="muted" />

      {/* Divider arrow */}
      <Arrow from={[196, 105]} to={[226, 105]} kind="straight" />

      <Label x={246} y={22} size={10} weight={700} tone="muted">
        AFTER
      </Label>
      {/* Snapped to a tidy grid */}
      <Shape x={250} y={48} w={56} h={30} kind="rect" accent />
      <Shape x={332} y={48} w={56} h={30} kind="rect" accent />
      <Shape x={250} y={120} w={56} h={30} kind="rect" accent />
      <Shape x={332} y={120} w={56} h={30} kind="rect" accent />
      <Arrow from={[306, 63]} to={[332, 63]} />
      <Arrow from={[278, 78]} to={[278, 120]} />
      <Arrow from={[360, 78]} to={[360, 120]} />
    </Scene>
  );
}

/** A locked tab: the padlock sits before its name, on the active tab (and on its row in the tab list). */
export function LockedTab() {
  return (
    <Scene w={420} h={130} bg="plain">
      <Label x={408} y={52} size={10} tone="muted" anchor="end">
        Locked: read-only until unlocked
      </Label>
      <DocumentGroup right={408} y={70} tab="Approved" count={3} people={TWO_PEOPLE} locked />
    </Scene>
  );
}
