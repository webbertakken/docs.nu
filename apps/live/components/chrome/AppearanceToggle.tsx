import {
  APPEARANCE_LABEL,
  AppearanceIcon,
  appearanceToggleName,
  FOLLOW_DEVICE_HINT,
  followDeviceOnContextMenu,
  HoverCard,
} from '@livedoc/ui';
import type { AppearanceSetting } from '@livedoc/ui';
import { useAppearance } from '@/hooks/ui/useAppearance';
import { ChromeLabel, useChromeButtonClass } from '@/components/chrome/chrome-button';

// The editor's Appearance control (docs/specs/004-interface-design/appearance.md): one button that CYCLES
// Light → Dark → System, in the actions group. A right-click (the context menu gesture) sets System. Flips only the
// editor chrome; a tab's theme is its own setting, except for Default, which follows this one
// (docs/specs/007-editor/live-app.md).
//
// The glyph shows the CURRENT setting, not the next one: with three states, one of them deferring to the OS, the
// only readable thing is where you are, so the hover card and accessible name carry where the next click takes you.

const DESCRIPTION: Record<AppearanceSetting, string> = {
  light: 'The editor chrome is light.',
  dark: 'The editor chrome is dark.',
  system: 'The editor chrome follows your device setting.',
};

export function AppearanceToggle({ labelled = false }: { labelled?: boolean }) {
  const { setting, set, cycle } = useAppearance();
  const buttonClass = useChromeButtonClass(labelled);
  const description =
    setting === 'system' ? DESCRIPTION[setting] : `${DESCRIPTION[setting]} ${FOLLOW_DEVICE_HINT}`;

  return (
    <HoverCard title={`Appearance: ${APPEARANCE_LABEL[setting]}`} description={description}>
      <button
        type="button"
        onClick={cycle}
        onContextMenu={followDeviceOnContextMenu(setting, set)}
        aria-label={appearanceToggleName(setting)}
        className={buttonClass}
      >
        <AppearanceIcon setting={setting} />
        <ChromeLabel show={labelled}>{APPEARANCE_LABEL[setting]}</ChromeLabel>
      </button>
    </HoverCard>
  );
}
