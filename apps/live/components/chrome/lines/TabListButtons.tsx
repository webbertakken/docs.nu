'use client';

import { TabsLabelIcon } from '@livedoc/ui';
import { ParticipantAvatar } from '@/components/primitives/ParticipantAvatar';
import type { Participant } from '@/lib/identity';
import { TOOLBAR_BUTTON, TOOLBAR_CONTROL_PRESSED } from '@/components/chrome/toolbar-surface';
import { CONTRIBUTORS_SHOWN } from './line-constants';

export function peopleHereLabel(count: number): string {
  return `${count} ${count === 1 ? 'person' : 'people'} here`;
}

type OpenerProps = {
  open: boolean;
  onToggle: (button: HTMLElement) => void;
};

const COUNT =
  'flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-slate-100 px-1.5 text-[11px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200';

// The tab stack (docs/specs/007-editor/toolbar-layout.md "The bottom line"): a stack glyph and the number of tabs in
// the session's scope. Always drawn, one tab too, so nothing on the line moves as tabs come and go. A press opens
// the tab list.
export function TabStackButton({ count, open, onToggle }: OpenerProps & { count: number }) {
  return (
    <button
      type="button"
      aria-label={`All tabs (${count})`}
      aria-haspopup="dialog"
      aria-expanded={open}
      data-tab-stack=""
      onClick={(e) => onToggle(e.currentTarget)}
      className={`${TOOLBAR_BUTTON} px-2 ${open ? TOOLBAR_CONTROL_PRESSED : ''}`}
    >
      <TabsLabelIcon />
      <span className={COUNT}>
        <span className="text-optical-centre">{count}</span>
      </span>
    </button>
  );
}

// The contributors: everyone else in the document, up to three avatars, then +N. The same tab list opens from it,
// with each row's presence. The caller draws it only while somebody else is here.
export function ContributorsButton({
  people,
  open,
  onToggle,
}: OpenerProps & { people: Participant[] }) {
  const shown = people.slice(0, CONTRIBUTORS_SHOWN);
  const more = people.length - shown.length;
  return (
    <button
      type="button"
      aria-label={peopleHereLabel(people.length)}
      aria-haspopup="dialog"
      aria-expanded={open}
      data-contributors=""
      onClick={(e) => onToggle(e.currentTarget)}
      className={`${TOOLBAR_BUTTON} px-2 ${open ? TOOLBAR_CONTROL_PRESSED : ''}`}
    >
      <span className="flex items-center">
        {shown.map((p, i) => (
          <span
            key={p.id}
            data-contributor=""
            className={`inline-flex rounded-full ring-2 ring-white dark:ring-slate-900 ${i > 0 ? '-ml-1' : ''}`}
          >
            <ParticipantAvatar participant={p} size={20} />
          </span>
        ))}
      </span>
      {more > 0 ? (
        <span className={COUNT}>
          <span className="text-optical-centre">+{more}</span>
        </span>
      ) : null}
    </button>
  );
}
