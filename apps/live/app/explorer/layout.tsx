import type { Metadata } from 'next';
import { Suspense, type ReactNode } from 'react';
import { ExplorerShell } from './ExplorerShell';
import { InPlaceEditor } from './in-place-editor/InPlaceEditor';

// The /explorer layout (docs/specs/013-workspace/folders.md): every section under /explorer is
// its own route page, and this layout wraps them all in the shared
// chrome — header, sidebar tree, mobile drawer, cross-section
// overlays — via ExplorerShell. App Router keeps the layout mounted
// across child navigations, so the shell's state (document list,
// folders, teams, expanded branches) survives switching sections.
//
// Suspense: the shell derives the current section from the URL via
// useSearchParams (folder/team ids ride the query string — see
// routes.ts), which `output: 'export'` requires to sit under a
// Suspense boundary at prerender time.
//
// The title here is the fallback for tab chrome (each section page
// overrides it); `index: false` is inherited from the root layout
// (docs/specs/007-editor/live-app.md keeps every /live route out of the index).
export const metadata: Metadata = {
  title: 'Explorer | LiveDoc',
};

export default function ExplorerLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={null}>
      {/* A document made from the New Document menu opens in the Explorer's place (InPlaceEditor). */}
      <InPlaceEditor>
        <ExplorerShell>{children}</ExplorerShell>
      </InPlaceEditor>
    </Suspense>
  );
}
