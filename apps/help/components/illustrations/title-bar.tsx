// The editor's two lines for the User Interface › The Two Lines article (docs/specs/018-help/help-app.md), drawn
// from apps/live/components/chrome/lines (the brand group, the actions group, the tools group and the document
// group), and the share-state icon's legend (VisibilityLegend). Labels are the real UI strings, in capitals where
// the editor prints them in capitals.

import { Label, Scene, Shape, Arrow } from './primitives';
import {
  ActionsGroup,
  BRAND_NAMED_W,
  BrandGroup,
  BrowserGlyph,
  DocumentGroup,
  GROUP_H,
  LinkGlyph,
  LockGlyph,
  MiniStrip,
  ShareStateIcon,
  TeamGlyph,
  ToolsGroup,
  actionsGroupWidth,
  documentGroupWidth,
  tabStackCentre,
  textW,
  toolsGroupWidth,
} from './editor-lines';

// --- The two lines ---------------------------------------------------------------

/** A callout: a thin dashed leader from a group's edge to its words. */
function Callout({
  x,
  from,
  to,
  text,
  anchor = 'middle',
}: {
  x: number;
  from: number;
  to: number;
  text: string;
  anchor?: 'start' | 'middle' | 'end';
}) {
  const down = to > from;
  return (
    <g>
      <line
        x1={x}
        y1={from}
        x2={x}
        y2={down ? to - 8 : to + 8}
        className="stroke-slate-300"
        strokeWidth={1}
        strokeDasharray="2 2"
      />
      <circle cx={x} cy={from} r={1.8} className="fill-slate-400" />
      <Label x={x} y={to} size={10} weight={600} tone="body" anchor={anchor}>
        {text}
      </Label>
    </g>
  );
}

/** The two lines over the canvas, as the owner of a shared document sees them: the brand group, the Palette strip
 *  and the actions group along the top; the tools group and the document group along the bottom. */
export function TwoLinesParts() {
  const W = 600;
  const top = 12;
  const bottom = 196;
  const brandRight = 12 + BRAND_NAMED_W;
  const actionsLeft = W - 12 - actionsGroupWidth({});
  const stripW = 196;
  const stripX = Math.round((brandRight + actionsLeft) / 2 - stripW / 2);
  const toolsW = toolsGroupWidth({});
  const docLeft = W - 12 - documentGroupWidth({});
  const nameEnd = docLeft + 30 + textW('Roadmap', 10.5) + 8 + 54;
  const tabMid = nameEnd + 8 + (26 + textW('Overview', 10.5) + 22) / 2;
  const stack = tabStackCentre(W - 12);
  return (
    <Scene w={W} h={240}>
      <BrandGroup x={12} y={top} named />
      <MiniStrip x={stripX} y={top} w={stripW} />
      <ActionsGroup right={W - 12} y={top} />
      <Callout x={12 + BRAND_NAMED_W / 2} from={top + GROUP_H} to={64} text="Brand group" />
      <Callout x={stripX + stripW / 2} from={top + GROUP_H} to={64} text="Palette strip" />
      <Callout x={actionsLeft + 60} from={top + GROUP_H} to={64} text="Actions group" />

      <Shape x={250} y={92} w={100} h={40} label="Checkout" />
      <Arrow from={[350, 112]} to={[410, 112]} />
      <Shape x={410} y={92} w={84} h={40} label="Pay" accent />

      <ToolsGroup x={12} y={bottom} />
      <DocumentGroup right={W - 12} y={bottom} />
      <Callout x={12 + toolsW / 2} from={bottom} to={176} text="Tools group" />
      <Callout x={docLeft + 50} from={bottom} to={156} text="Name and role" />
      <Callout x={tabMid} from={bottom} to={176} text="Active tab" />
      <Callout x={stack} from={bottom} to={156} text="Tab stack" />
      <Callout x={W - 50} from={bottom} to={176} text="People, +" />
    </Scene>
  );
}

// --- The visibility legend -------------------------------------------------------

const STOPS = [
  { word: 'Just you', Icon: LockGlyph },
  { word: 'Link', Icon: LinkGlyph },
  { word: 'Team', Icon: TeamGlyph },
] as const;

/** The legend that opens from the share-state icon, for a Shared document: the hero with its
 *  reach rings, the three audiences from Just you to Team with Link filled to, This Browser
 *  apart beneath them, and Change Who Can See This for the owner. */
export function VisibilityLegendFigure() {
  const cardX = 70;
  const cardW = 280;
  const top = 40;
  const bottom = 290;
  const ringsX = 112;
  const ringsY = top + 40;
  const stopY = 166;
  const stopXs = [117, 210, 303];
  return (
    <Scene w={420} h={300}>
      <g transform="translate(0 -30)">
        {/* The card. */}
        <rect
          x={cardX}
          y={top}
          width={cardW}
          height={bottom - top}
          rx={12}
          className="fill-white stroke-slate-200"
          strokeWidth={1.5}
        />
        {/* Hero: the current state's wash, its reach rings and its words. */}
        <path
          d={`M${cardX} ${top + 12} a12 12 0 0 1 12 -12 H${cardX + cardW - 12} a12 12 0 0 1 12 12 V${top + 82} H${cardX} Z`}
          className="fill-emerald-50"
        />
        <circle
          cx={ringsX}
          cy={ringsY}
          r={17}
          className="fill-emerald-500/15 stroke-emerald-500"
          strokeWidth={1.4}
        />
        {[27].map((r) => (
          <circle
            key={r}
            cx={ringsX}
            cy={ringsY}
            r={r}
            fill="none"
            className="stroke-emerald-300"
            strokeWidth={1}
            strokeDasharray="2 3"
          />
        ))}
        {[-60, 12].map((deg) => {
          const a = (deg * Math.PI) / 180;
          return (
            <circle
              key={deg}
              cx={ringsX + 17 * Math.cos(a)}
              cy={ringsY + 17 * Math.sin(a)}
              r={2.4}
              className="fill-emerald-600"
            />
          );
        })}
        <circle cx={ringsX} cy={ringsY} r={7} className="fill-emerald-600" />
        <circle cx={ringsX} cy={ringsY - 2} r={2.1} className="fill-white help-art-as-drawn" />
        <path
          d={`M${ringsX - 3.8} ${ringsY + 4} a3.8 3.8 0 0 1 7.6 0`}
          className="fill-white help-art-as-drawn"
        />
        <Label
          x={152}
          y={top + 22}
          size={8.5}
          weight={700}
          className="fill-emerald-700 dark:fill-emerald-300"
        >
          WHO CAN SEE THIS
        </Label>
        <LinkGlyph x={158} y={top + 40} cls="stroke-emerald-600" />
        <Label x={168} y={top + 41} size={14} weight={700} tone="strong">
          Shared
        </Label>
        <Label x={152} y={top + 60} size={9.5} tone="body">
          Anyone with a link can open it.
        </Label>

        {/* The audiences on one scale, filled to the current stop. */}
        <rect x={117} y={stopY - 2} width={186} height={4} rx={2} className="fill-slate-100" />
        <rect x={117} y={stopY - 2} width={93} height={4} rx={2} className="fill-emerald-400" />
        {STOPS.map(({ word, Icon }, i) => {
          const cx = stopXs[i]!;
          const current = i === 1;
          const reached = i < 1;
          return (
            <g key={word}>
              {current ? (
                <>
                  <circle cx={cx} cy={stopY} r={17} className="fill-emerald-100" />
                  <circle cx={cx} cy={stopY} r={14} className="fill-emerald-600" />
                </>
              ) : (
                <circle
                  cx={cx}
                  cy={stopY}
                  r={12}
                  className={
                    reached ? 'fill-white stroke-slate-300' : 'fill-white stroke-slate-200'
                  }
                  strokeWidth={reached ? 2 : 1.2}
                />
              )}
              <Icon
                x={cx}
                y={stopY}
                cls={
                  current
                    ? 'stroke-white help-art-as-drawn'
                    : reached
                      ? 'stroke-slate-600'
                      : 'stroke-slate-400'
                }
              />
              <Label
                x={cx}
                y={stopY + 27}
                size={9.5}
                weight={current ? 700 : 400}
                tone={current ? 'strong' : 'muted'}
                anchor="middle"
              >
                {word}
              </Label>
            </g>
          );
        })}

        {/* This Browser, apart from the scale. */}
        <rect x={82} y={212} width={256} height={28} rx={8} className="fill-slate-50" />
        <circle cx={97} cy={226} r={9} className="fill-white stroke-amber-200" strokeWidth={1} />
        <BrowserGlyph x={97} y={226} cls="stroke-amber-600" />
        <Label x={112} y={227} size={9} tone="body">
          <tspan fontWeight={700} className="fill-slate-800">
            Or This Browser
          </tspan>
          : never leaves this browser.
        </Label>

        {/* For the owner: Change Who Can See This opens Share. */}
        <rect x={82} y={250} width={256} height={28} rx={8} className="fill-brand-700" />
        <Label x={198} y={265} size={10.5} weight={700} tone="onAccent" anchor="middle">
          Change Who Can See This
        </Label>
        <path
          d="M279 261 l4 4 l-4 4"
          className="stroke-white help-art-as-drawn"
          fill="none"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      {/* The share-state icon the legend opens from, before the document's name, in the document group. */}
      <ShareStateIcon cx={150} cy={284} />
      <Label x={164} y={285} size={11} tone="body">
        Checkout Flow
      </Label>
    </Scene>
  );
}
