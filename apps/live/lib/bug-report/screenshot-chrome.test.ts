// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { isBugReportChrome } from './screenshot';

// docs/specs/016-platform/bug-reports.md "The form": Capture Screen pictures the page without the form.

const html = (markup: string) => {
  const host = document.createElement('div');
  host.innerHTML = markup;
  return host.firstElementChild!;
};

describe('isBugReportChrome', () => {
  it('leaves out an entry and the form with its backdrop', () => {
    expect(isBugReportChrome(html('<button data-bug-report-entry></button>'))).toBe(true);
    expect(isBugReportChrome(html('<iframe data-bug-report-capture></iframe>'))).toBe(true);
    const backdrop = html(
      '<div><div data-dialog-panel><div data-bug-report-dialog></div></div></div>',
    );
    expect(isBugReportChrome(backdrop)).toBe(true);
    // The focus trap's sentinels may come first.
    const guarded = html(
      '<div><span tabindex="0"></span><div data-dialog-panel><div data-bug-report-dialog></div></div></div>',
    );
    expect(isBugReportChrome(guarded)).toBe(true);
  });

  it('keeps another dialog, the page and text', () => {
    expect(isBugReportChrome(html('<div><div data-dialog-panel><p>Settings</p></div></div>'))).toBe(
      false,
    );
    expect(isBugReportChrome(html('<main><p>Page</p></main>'))).toBe(false);
    expect(isBugReportChrome(document.createTextNode('text'))).toBe(false);
  });
});
