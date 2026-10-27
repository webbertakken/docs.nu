// Home's first run (docs/specs/013-workspace/explorer-home.md "First run"), pure: when a person has nothing yet, the
// copy the welcome speaks with. The starts themselves (template picks) are first-run-starts.ts, kept apart so a
// returning person's Home never loads the template catalogue.

/** Nothing yet: once the lists have loaded, no document of their own, shared, in a team or in this browser. A list
 * that failed to load says nothing, so it is never read as an empty account. */
export function isFirstRun(input: {
  loading: boolean;
  failed: boolean;
  documents: number;
  shared: number;
  teamDocuments: number;
  offlineDocuments: number;
}): boolean {
  return (
    !input.loading &&
    !input.failed &&
    input.documents === 0 &&
    input.shared === 0 &&
    input.teamDocuments === 0 &&
    input.offlineDocuments === 0
  );
}

/** The wizard, for Browse All Templates. */
export const WELCOME_ALL_TEMPLATES_HREF = '/new';

export const WELCOME_COPY = {
  blanksTitle: 'Start Blank',
  popularTitle: 'Popular Templates',
  allTemplates: 'Browse All Templates',
  haveWorkTitle: 'Already Have Work?',
  signInTitle: 'Nothing here yet? Sign in',
  signInLine: 'If you have used LiveDoc before, sign in and your documents come back with you.',
  signIn: 'Sign In',
  importTitle: 'Bring It With You',
  importLine:
    'Import boards from Miro, draw.io, Excalidraw or Microsoft Whiteboard; each becomes its own document.',
} as const;
