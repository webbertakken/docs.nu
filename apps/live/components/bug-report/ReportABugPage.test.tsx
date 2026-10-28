import { describe, expect, it } from 'vitest';
import { backTarget } from './ReportABugPage';

// docs/specs/016-platform/bug-reports.md "Entries": closing the form page goes back where the reporter came from,
// only ever on this origin.
describe('backTarget', () => {
  it.each([
    ['?from=/help/contact/', '/help/contact/'],
    ['?from=%2Fabout%2Ffaq', '/about/faq'],
    ['', '/'],
    ['?from=https://evil.example/', '/'],
    ['?from=//evil.example/', '/'],
    ['?from=/\\evil.example', '/'],
    ['?from=javascript:alert(1)', '/'],
  ])('goes back to %s as %s', (search, target) => {
    expect(backTarget(search)).toBe(target);
  });
});
