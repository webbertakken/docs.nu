import type { AppearanceSetting } from './appearance-store';

// The cycle every Appearance control walks. Light and Dark first (the two picks
// anyone reaching for the control wants), System last as the "you decide" step
// that hands the choice back to the device.
const CYCLE: readonly AppearanceSetting[] = ['light', 'dark', 'system'];

export function nextAppearanceSetting(setting: AppearanceSetting): AppearanceSetting {
  return CYCLE[(CYCLE.indexOf(setting) + 1) % CYCLE.length]!;
}

// The setting's name, as a control and its accessible name say it. Also the
// editor's telemetry `type` preset, so it is closed vocabulary, never user content.
export const APPEARANCE_LABEL: Record<AppearanceSetting, string> = {
  light: 'Light',
  dark: 'Dark',
  system: 'System',
};

// The hint every Appearance control carries while it is off System: the context menu gesture hands the choice
// back to the device (docs/specs/004-interface-design/appearance.md "The control").
export const FOLLOW_DEVICE_HINT = 'Right-click to follow your device.';

// The accessible name of the control: where you are, where a click goes, and, off System, the right-click.
export function appearanceToggleName(setting: AppearanceSetting): string {
  const name = `Appearance: ${APPEARANCE_LABEL[setting]}. Switch to ${APPEARANCE_LABEL[nextAppearanceSetting(setting)]}.`;
  return setting === 'system' ? name : `${name} ${FOLLOW_DEVICE_HINT}`;
}

// The context menu gesture on any Appearance control: System, and never the browser's menu.
export function followDeviceOnContextMenu(
  setting: AppearanceSetting,
  set: (next: AppearanceSetting) => void,
): (event: { preventDefault: () => void }) => void {
  return (event) => {
    event.preventDefault();
    if (setting !== 'system') set('system');
  };
}
