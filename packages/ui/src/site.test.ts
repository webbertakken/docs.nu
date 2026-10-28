import { describe, expect, it } from 'vitest';
import { BRAND_APPLE_WEB_APP, BRAND_ICONS, CONTACT_FORM_URL } from './site';

// docs/specs/004-interface-design/brand-mark.md "Icons and media".
describe('brand icons and home-screen metadata', () => {
  it('names the iOS home-screen tile LiveDoc and opens it standalone', () => {
    expect(BRAND_APPLE_WEB_APP).toEqual({
      title: 'LiveDoc',
      capable: true,
      statusBarStyle: 'default',
    });
  });

  it('offers the SVG mark, a PNG fallback and the opaque Apple tile', () => {
    expect(BRAND_ICONS).toEqual({
      icon: [
        { url: '/icon.svg', type: 'image/svg+xml' },
        { url: '/livedoc-icon-256.png', type: 'image/png', sizes: '256x256' },
      ],
      apple: '/apple-icon',
    });
  });
});

// docs/specs/018-help/help-pages.md "The contact form": a LiveDoc form on docs.nu, never another product's.
describe('the contact form', () => {
  it('is a published LiveDoc form on docs.nu', () => {
    expect(CONTACT_FORM_URL).toMatch(/^https:\/\/docs\.nu\/form\/[A-Za-z0-9]{22}$/);
  });
});
