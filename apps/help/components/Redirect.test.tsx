// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Redirect } from './Redirect';

// docs/specs/018-help/help-app.md "Renamed articles": a moved page keeps an old deep link's #section.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function stubLocation(hash: string) {
  const replace = vi.fn();
  vi.spyOn(window, 'location', 'get').mockReturnValue({ ...window.location, hash, replace });
  return replace;
}

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('Redirect', () => {
  it('sends the reader on with the old address’s #section', () => {
    const replace = stubLocation('#folders');
    const host = document.body.appendChild(document.createElement('div'));
    act(() =>
      createRoot(host).render(
        <Redirect href="/help/explorer/the-explorer/" label="Explorer guide" />,
      ),
    );
    expect(replace).toHaveBeenCalledWith('/help/explorer/the-explorer/#folders');
  });
});
