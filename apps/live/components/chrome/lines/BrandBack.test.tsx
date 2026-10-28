// @vitest-environment jsdom

// Back, the brand group's first control (docs/specs/007-editor/toolbar-layout.md "The top line"): a back caret and the
// logo, one link to the Explorer; in a workspace frame, back to where the document was opened from; where there is
// nowhere to go back to, the mark alone.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EXPLORER_LANDING_PATH } from '@/lib/explorer-landing';
import { BrandBack } from './BrandBack';

const track = vi.hoisted(() => vi.fn());
vi.mock('@/lib/telemetry', () => ({ track }));

afterEach(() => {
  cleanup();
  track.mockClear();
});

describe('BrandBack', () => {
  it('links to the Explorer with the caret and the mark, no wordmark', () => {
    render(<BrandBack target={{ kind: 'explorer' }} />);
    const link = screen.getByRole('link', { name: 'Back to the Explorer' });
    expect(link.getAttribute('href')).toBe(EXPLORER_LANDING_PATH);
    expect(link.querySelector('[data-back-caret]')).not.toBeNull();
    expect(link.querySelector('[data-logotype]')).toBeNull();
    // The caret leads, the mark (24px) follows.
    expect(link.firstElementChild?.hasAttribute('data-back-caret')).toBe(true);
    expect(link.querySelector('svg:not([data-back-caret])')?.getAttribute('class')).toContain(
      'size-6',
    );
  });

  it('draws the caret as the spec sizes it: 8 x 14, a 1.75 round stroke', () => {
    render(<BrandBack target={{ kind: 'explorer' }} />);
    const caret = document.querySelector('[data-back-caret]')!;
    // 14px tall; its 14px box trimmed 3px either side to the chevron's 8px.
    expect(caret.getAttribute('height')).toBe('14');
    expect(caret.getAttribute('class')).toContain('-mx-[3px]');
    expect(caret.getAttribute('stroke-width')).toBe('1.75');
    expect(caret.getAttribute('stroke-linecap')).toBe('round');
    // The spec's M6.5 1.5 1.5 7l5 5.5, centred in the 14-unit box.
    expect(caret.querySelector('path')?.getAttribute('d')).toBe('M9.5 1.5 4.5 7l5 5.5');
  });

  it('counts a press', () => {
    render(<BrandBack target={{ kind: 'explorer' }} />);
    const link = screen.getByRole('link', { name: 'Back to the Explorer' });
    link.addEventListener('click', (e) => e.preventDefault());
    fireEvent.click(link);
    expect(track).toHaveBeenCalledWith('UI', 'Opened', 'BrandBack');
  });

  it('in a workspace frame, goes back where the document was opened from', () => {
    const back = vi.fn();
    render(<BrandBack target={{ kind: 'frame', back, backTitle: 'Roadmap' }} />);
    const button = screen.getByRole('button', { name: 'Back' });
    expect(button.querySelector('[data-back-caret]')).not.toBeNull();
    fireEvent.click(button);
    expect(back).toHaveBeenCalledOnce();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('with nowhere to go back to, draws the mark alone, not a link', () => {
    const { container } = render(<BrandBack target={{ kind: 'none' }} />);
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
    expect(container.querySelector('[data-back-caret]')).toBeNull();
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('tints the mark with the tab theme accent', () => {
    const plain = render(<BrandBack target={{ kind: 'explorer' }} />).container.querySelector(
      'stop',
    );
    const plainStop = plain?.getAttribute('style');
    cleanup();
    const tinted = render(<BrandBack target={{ kind: 'explorer' }} accent="#ff0000" />).container;
    expect(tinted.querySelector('stop')?.getAttribute('style')).not.toBe(plainStop);
  });
});
