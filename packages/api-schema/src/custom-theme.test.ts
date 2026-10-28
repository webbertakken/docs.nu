import { describe, expect, it } from 'vitest';
import { customThemeDefinition } from './custom-theme';

// A saved custom theme as a ThemeDefinition (docs/specs/011-theme/custom-themes.md).
describe('customThemeDefinition', () => {
  it('makes the row id and name the theme id and label, the definition its colours', () => {
    const def = customThemeDefinition({
      id: 'custom:1',
      name: 'Brandy',
      definition: {
        backgroundColor: '#ffffff',
        backgroundPattern: 'grid',
        patternColor: '#cbd5e1',
        elementFill: '#dbeafe',
        elementStroke: '#2563eb',
        elementText: '#1e3a8a',
        shapeColors: { diamond: { fill: '#fef3c7' } },
      },
    });
    expect(def.id).toBe('custom:1');
    expect(def.label).toBe('Brandy');
    expect(def.elementStroke).toBe('#2563eb');
    expect(def.shapeColors?.diamond?.fill).toBe('#fef3c7');
  });
});
