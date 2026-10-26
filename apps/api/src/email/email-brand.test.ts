import { describe, expect, it } from 'vitest';
import type { Env } from '../types';
import { everyEmail } from './test-email-fixtures';

const env = { APP_BASE_URL: 'https://app.test' } as unknown as Env;
const emails = Object.entries(everyEmail(env));

// docs/specs/014-identity/transactional-email.md "Branding": every email is LiveDoc's, in its subject, its
// body and its plain-text part; no earlier product name survives anywhere a recipient can see it.
describe('email brand', () => {
  it.each(emails)('%s names LiveDoc and nothing else', (_name, email) => {
    for (const part of [email.subject, email.html, email.text ?? '']) {
      expect(part).not.toMatch(/livediagram/i);
    }
    expect(email.html).toContain('>Live</span>Doc');
  });

  it.each(emails)('%s shows the LiveDoc mark in the header and footer', (_name, email) => {
    expect(
      email.html.match(/src="https:\/\/app\.test\/email\/livedoc-mark-64\.png"/g),
    ).toHaveLength(2);
  });
});
