import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { cardSubtitle, CARD_SUBTITLE_MAX, renderSocialCard } from './social-card';

describe('cardSubtitle', () => {
  it('keeps text that already fits', () => {
    expect(cardSubtitle('Short and sweet.')).toBe('Short and sweet.');
  });

  it('uses the first sentence when the whole text is too long', () => {
    const text = `First sentence fits. ${'Then a great deal more '.repeat(10)}`;
    expect(cardSubtitle(text)).toBe('First sentence fits.');
  });

  it('cuts at a whole word, never mid-word, and drops trailing punctuation', () => {
    const text = `Switch a tab to Plan and the work moves onto boards of cards: columns with WIP limits, swimlanes, card types with fields and more`;
    const out = cardSubtitle(text);
    expect(out.endsWith('…')).toBe(true);
    expect(out.length).toBeLessThanOrEqual(CARD_SUBTITLE_MAX);
    expect(text.startsWith(out.slice(0, -1))).toBe(true);
    expect(text[out.length - 1]).toMatch(/[\s,]/);
  });

  it('cuts a single unbroken word at the limit', () => {
    expect(cardSubtitle('x'.repeat(200), 10)).toBe(`${'x'.repeat(9)}…`);
  });
});

// The share card every link preview shows (docs/specs/004-interface-design/brand-mark.md "Wordmark"; the purpose,
// docs/specs/001-project-vision/purpose.md): the LiveDoc wordmark and LiveDoc's words, never the old product's.
describe('renderSocialCard', () => {
  const text = (html: string) => html.replace(/<[^>]+>/g, '').replace(/&nbsp;|\u00a0/g, ' ');
  const html = renderToStaticMarkup(renderSocialCard());

  it('sets the wordmark as Live in the accent, then Doc', () => {
    expect(html).toMatch(/<span style="color:#0284c7">Live<\/span><span>Doc<\/span>/);
  });

  it('speaks of documents, not diagrams or drawing', () => {
    expect(text(html)).toContain('Documents together, live.');
    expect(text(html)).toContain('No sign-up. Open the link and start.');
    expect(text(html)).not.toMatch(/diagram|drawing/i);
  });
});
