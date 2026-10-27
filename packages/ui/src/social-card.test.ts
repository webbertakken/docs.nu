import { isValidElement } from 'react';
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
  // The card's text, read from its element tree (no markup to strip), with non-breaking spaces as spaces.
  const textOf = (node: unknown): string => {
    if (typeof node === 'string' || typeof node === 'number') return String(node);
    if (Array.isArray(node)) return node.map(textOf).join('');
    if (isValidElement<{ children?: unknown }>(node)) return textOf(node.props.children);
    return '';
  };
  const card = renderSocialCard();
  const html = renderToStaticMarkup(card);
  const text = () => textOf(card).replace(/\u00a0/g, ' ');

  // The card's renderer (next/og) sets a gap between two spans; Doc's margin closes it, so the two read as one
  // word, as wide as plain "LiveDoc" (measured: 150px either way at 44px).
  it('sets the wordmark as Live in the accent, then Doc, closed up into one word', () => {
    expect(html).toMatch(
      /<span style="color:#0284c7">Live<\/span><span style="margin-left:-5px">Doc<\/span>/,
    );
  });

  it('speaks of documents, not diagrams or drawing', () => {
    expect(text()).toContain('Documents together, live.');
    expect(text()).toContain('No sign-up. Open the link and start.');
    expect(text()).not.toMatch(/diagram|drawing/i);
  });
});
