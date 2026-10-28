import type { CustomTheme } from '@livedoc/api-schema';
import { afterEach, describe, expect, it } from 'vitest';
import {
  clearCustomThemeRegistry,
  isCustomThemeId,
  lookupCustomTheme,
  registerCustomTheme,
  registerCustomThemes,
  unregisterCustomTheme,
} from './custom-theme-registry';
import { getTheme } from './themes';

const theme = (id: string, name: string): CustomTheme => ({
  id,
  ownerId: 'owner-1',
  name,
  definition: {
    backgroundColor: '#ffffff',
    backgroundPattern: 'grid',
    patternColor: '#cbd5e1',
    elementFill: '#dbeafe',
    elementStroke: '#2563eb',
    elementText: '#1e3a8a',
    shapeColors: { diamond: { fill: '#fef3c7' } },
  },
  createdAt: 1,
  updatedAt: 1,
});

afterEach(() => clearCustomThemeRegistry());

describe('custom-theme registry (docs/specs/011-theme/custom-themes.md)', () => {
  it('getTheme resolves a registered custom theme by id', () => {
    registerCustomTheme(theme('custom:1', 'Brandy'));
    expect(getTheme('custom:1').label).toBe('Brandy');
    expect(lookupCustomTheme('custom:1')).toBeDefined();
  });

  it('getTheme falls back to the default for an unregistered (or deleted) custom id', () => {
    registerCustomTheme(theme('custom:1', 'Brandy'));
    unregisterCustomTheme('custom:1');
    // A document still referencing the deleted theme keeps rendering: it
    // gets the default (brand) theme, not a crash.
    expect(getTheme('custom:1').id).toBe('brand');
  });

  it('still resolves built-in themes when a custom registry is populated', () => {
    registerCustomThemes([theme('custom:1', 'A'), theme('custom:2', 'B')]);
    expect(getTheme('forest').id).toBe('forest');
    expect(getTheme(undefined).id).toBe('brand');
  });

  it('isCustomThemeId only matches the custom: prefix', () => {
    expect(isCustomThemeId('custom:abc')).toBe(true);
    expect(isCustomThemeId('forest')).toBe(false);
    expect(isCustomThemeId(undefined)).toBe(false);
  });
});
