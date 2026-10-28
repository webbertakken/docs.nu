'use client';

import { useUiScale } from '@/components/providers/ui-scale';
import { toSurfacePx, uiScaleStyle } from '@/lib/ui-scale';
import { AuthControls } from '@/components/chrome/AuthControls';
import { ChromeControls } from '@/components/chrome/ChromeControls';
import { ToolbarGroup, ToolbarPart } from '@/components/chrome/ToolbarGroup';
import { WorkbenchOpenLink } from '@/components/chrome/WorkbenchChrome';
import { BAND_BLEND, BAND_TINT } from '@/components/chrome/toolbar-surface';
import { PHONE_TOOLBAR_ITEMS } from '@/components/chrome/phone-toolbar-items';
import { TourOfferButton } from '@/components/tour/TourOfferButton';
import { DocumentActions, type DocumentActionsProps } from './DocumentActions';

export type ActionsGroupProps = DocumentActionsProps & {
  onOpenSearch?: () => void;
  onOpenSettings?: () => void;
  powerUser?: boolean;
  // Button Labels (docs/specs/007-editor/user-preferences.md): Search, Settings and the appearance by name.
  labelled?: boolean;
  // The document's actions (Start Tour, Copy, Present, Share) and the chrome trio; false through the welcome flow,
  // which keeps the account control alone.
  documentActions: boolean;
  // In a workbench: Open in LiveDoc, the app's own address for what the frame shows. The appearance follows the
  // workbench there, so no toggle.
  workbenchOpenHref?: string;
  onOpenAccount?: () => void;
};

// The actions group, the top line's right (docs/specs/007-editor/toolbar-layout.md "The top line"): Search,
// Settings, the appearance toggle, then the document actions that apply, then the account control, each part after
// a divider. Each control keeps its own rule for who sees it (live-app.md). `data-toolbar-actions` is what the strip
// measures to keep clear of it (lib/top-line-clearance).
export function ActionsGroup({
  onOpenSearch,
  onOpenSettings,
  powerUser = false,
  labelled = false,
  documentActions,
  workbenchOpenHref,
  onOpenAccount,
  ...actions
}: ActionsGroupProps) {
  // Drawn at the UI scale (docs/specs/007-editor/ui-scale.md), still 12px from the corner.
  const scale = useUiScale('toolbar');
  return (
    <ToolbarGroup
      label="Actions"
      data-toolbar-actions=""
      data-floating-panel=""
      data-region="actions"
      style={
        scale === 1
          ? undefined
          : { ...uiScaleStyle(scale), top: toSurfacePx(12, scale), right: toSurfacePx(12, scale) }
      }
      className={`pointer-events-auto absolute right-3 top-3 z-[var(--z-toolbar)] [&:not(:has([data-toolbar-part]:not(:empty)))]:hidden ${BAND_TINT} ${BAND_BLEND} ${PHONE_TOOLBAR_ITEMS}`}
      onPointerDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      {documentActions ? (
        <>
          <ToolbarPart>
            <ChromeControls
              onOpenSearch={onOpenSearch}
              onOpenSettings={onOpenSettings}
              settingsLabel="Application settings"
              settingsDescription="Your editor preferences. They follow your account, not this document."
              labelled={labelled}
              github={false}
              powerUser={powerUser}
              appearance={!workbenchOpenHref}
              tourOffer={false}
            />
          </ToolbarPart>
          <ToolbarPart>
            <TourOfferButton labelled={labelled} />
            <DocumentActions {...actions} />
            {workbenchOpenHref ? (
              <WorkbenchOpenLink href={workbenchOpenHref} labelled={labelled} />
            ) : null}
          </ToolbarPart>
        </>
      ) : null}
      <ToolbarPart>
        <AuthControls onOpenAccount={onOpenAccount} />
      </ToolbarPart>
    </ToolbarGroup>
  );
}
