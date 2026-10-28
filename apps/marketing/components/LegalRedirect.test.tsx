// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LegalRedirect } from './LegalRedirect';

// docs/specs/018-help/help-app.md "Renamed articles": a retired legal page keeps an old deep link's #section.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('LegalRedirect', () => {
  it('sends the reader on with the old address’s #section', () => {
    const replace = vi.fn();
    vi.spyOn(window, 'location', 'get').mockReturnValue({
      ...window.location,
      hash: '#cookies',
      replace,
    });
    const host = document.body.appendChild(document.createElement('div'));
    act(() =>
      createRoot(host).render(
        <LegalRedirect
          href="/help/policies/privacy-policy/"
          heading="The Privacy Policy has moved"
          linkText="Read it here"
        />,
      ),
    );
    expect(replace).toHaveBeenCalledWith('/help/policies/privacy-policy/#cookies');
  });
});
