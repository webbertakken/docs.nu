// A saved custom theme (docs/specs/011-theme/custom-themes.md) as the ThemeDefinition every theme
// engine reads: the stored definition, with the row's id and name as the theme's id and label. Shared by
// the editor's registry and the api worker's Explorer thumbnails, which draw a tab in its theme's halves.
import type { ThemeDefinition } from '@livedoc/document';
import type { CustomTheme } from './index';

export function customThemeDefinition(
  t: Pick<CustomTheme, 'id' | 'name' | 'definition'>,
): ThemeDefinition {
  // The one spot a `custom:<uuid>` string meets ThemeDefinition's `ThemeId` union: safe, because theme lookups
  // key on the string and never narrow it back.
  return { id: t.id as ThemeDefinition['id'], label: t.name, ...t.definition };
}
