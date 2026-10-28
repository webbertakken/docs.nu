import { describe, expect, it } from 'vitest';
import { redirectTarget } from './redirect-target';

// docs/specs/018-help/help-app.md "Renamed articles": a redirect keeps an old deep link's #section.
describe('redirectTarget', () => {
  it('carries the old address’s #section onto the new one', () => {
    expect(redirectTarget('/help/explorer/the-explorer/', '#folders')).toBe(
      '/help/explorer/the-explorer/#folders',
    );
  });

  it('keeps a new address’s own #section', () => {
    expect(redirectTarget('/help/canvas/#zoom', '#old')).toBe('/help/canvas/#zoom');
  });

  it('adds nothing when the old address had no section', () => {
    expect(redirectTarget('/help/canvas/', '')).toBe('/help/canvas/');
    expect(redirectTarget('/help/canvas/', '#')).toBe('/help/canvas/');
  });
});
