'use client';

import type { Tab } from '@livedoc/document';
import { NameEditor } from '@/components/primitives/NameEditor';
import { EllipsisMenuButton } from '@/components/chrome/EllipsisMenuButton';
import { TabLockIcon } from '@/components/chrome/tab-bar-icons';
import { TabModeIcon } from '@/components/chrome/editor-mode/TabModeIcon';
import { MenuNameSlot } from '@/components/plan/menu-name-slot';
import { activeTabTint } from './TabListRow';
import type { TabsChrome, TabsChromeProps } from './tabs-chrome';

// While a covering board's, view's or Sheet's title rides in the segment (menu-name-slot), the tab's own name steps
// aside, so the segment never shows two.
const HIDE_BESIDE_SLOT = '[[data-menu-name-slot]:not(:empty)+&]:hidden';

// The active tab in the document group (docs/specs/007-editor/toolbar-layout.md "The bottom line"): a tinted segment
// (the tab's accent, its inset ring; never a bordered pill), its mode glyph, its name and its tab menu. It never
// shortens. A click on the name renames it in place for someone who may change the document's tabs, a double-click
// too. `data-tour-id="active-tab"`: the Diagram tour's Tabs step rings it with its ⋯ menu.
export function ActiveTabSegment({
  tab,
  tabs,
  chrome,
}: {
  tab: Tab;
  tabs: TabsChromeProps;
  chrome: TabsChrome;
}) {
  const readOnly = tabs.readOnly ?? false;
  const isEditing = chrome.editingId === tab.id && !readOnly;
  const rename = () => {
    if (!readOnly) chrome.setEditingId(tab.id);
  };
  return (
    <div
      data-tour-id="active-tab"
      data-active-tab-segment=""
      onContextMenu={
        readOnly
          ? undefined
          : (e) => {
              e.preventDefault();
              chrome.setMenuFor(tab.id);
            }
      }
      style={isEditing ? undefined : activeTabTint(tab, chrome.isDark)}
      className={`flex h-9 shrink-0 items-center gap-1.5 rounded-md text-[13px] font-medium ${
        isEditing ? '' : `bg-slate-100 pl-2 dark:bg-slate-800 ${readOnly ? 'pr-2.5' : 'pr-1'}`
      }`}
    >
      {isEditing ? null : <TabModeIcon tab={tab} />}
      {tab.locked && !isEditing ? <TabLockIcon /> : null}
      <MenuNameSlot />
      {isEditing ? (
        <NameEditor
          initial={tab.name}
          onCommit={(name) => {
            tabs.onRename(tab.id, name.trim() || tab.name);
            chrome.setEditingId(null);
          }}
          onCancel={() => chrome.setEditingId(null)}
          className="h-9 w-40 rounded-md bg-white px-2 text-[13px] font-medium text-slate-800 outline-none ring-1 ring-brand-300 dark:bg-slate-800 dark:text-slate-100 dark:ring-brand-400"
        />
      ) : readOnly ? (
        <span className={`whitespace-nowrap text-optical-centre ${HIDE_BESIDE_SLOT}`}>
          {tab.name}
        </span>
      ) : (
        <button
          type="button"
          onClick={rename}
          onDoubleClick={rename}
          aria-current="page"
          className={`relative flex h-9 items-center whitespace-nowrap rounded outline-none touch-target-y focus-visible:ring-2 focus-visible:ring-brand-400 ${HIDE_BESIDE_SLOT}`}
        >
          <span className="text-optical-centre">{tab.name}</span>
        </button>
      )}
      {!isEditing && !readOnly ? (
        <EllipsisMenuButton
          open={chrome.menuFor === tab.id}
          onToggle={() => chrome.setMenuFor(chrome.menuFor === tab.id ? null : tab.id)}
          onClose={() => chrome.setMenuFor(null)}
          canvas={tabs.canvasActions}
          {...chrome.tabMenuProps(tab, () => chrome.setMenuFor(null))}
        />
      ) : null}
    </div>
  );
}
