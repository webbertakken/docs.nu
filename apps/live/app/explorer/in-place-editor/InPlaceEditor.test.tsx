// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ usePathname: () => window.location.pathname }));
vi.mock('@/lib/editor-page-loader', () => ({
  loadEditorPage: vi.fn(async () => Editor),
  loadedEditorPage: () => Editor,
}));
vi.mock('@/app/explorer/new-document/start-new-document', () => ({
  prefetchNewDocumentOpenWhenIdle: () => () => {},
}));
const settled = vi.hoisted(() => ({ value: false }));
vi.mock('@/lib/new-document/pending-documents', () => ({
  isPendingSettled: () => settled.value,
}));

function Editor() {
  return <div data-testid="editor">editor at {window.location.pathname}</div>;
}

import { InPlaceEditor, IN_PLACE_SETTLE_POLL_MS } from './InPlaceEditor';
import { closeInPlace, openInPlace } from './in-place-editor-store';

const ID = 'd0c0ffee-0000-4000-8000-0000000000bb';

function mount() {
  return render(
    <InPlaceEditor>
      <div data-testid="explorer">explorer</div>
    </InPlaceEditor>,
  );
}

const editorShown = () => {
  const editor = screen.queryByTestId('editor');
  return editor !== null && (editor.parentElement as HTMLElement).style.display !== 'none';
};

const goBack = () =>
  act(() => {
    window.history.replaceState(null, '', '/explorer/home');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });

beforeEach(() => {
  vi.useFakeTimers();
  settled.value = false;
  window.history.replaceState(null, '', '/explorer/home');
});
afterEach(() => {
  act(() => closeInPlace(ID));
  vi.useRealTimers();
});

describe('InPlaceEditor', () => {
  it('shows the Explorer until a document opens in its place', () => {
    mount();
    expect(screen.getByTestId('explorer')).toBeTruthy();
    expect(screen.queryByTestId('editor')).toBeNull();
  });

  it('shows the editor in the Explorer’s place at the document’s address', () => {
    mount();
    act(() => {
      window.history.pushState(null, '', `/document/${ID}`);
      openInPlace(ID);
    });
    expect(editorShown()).toBe(true);
    expect(screen.queryByTestId('explorer')).toBeNull();
  });

  it('returns to the Explorer on Back, keeping the editor hidden until its document is settled', () => {
    mount();
    act(() => {
      window.history.pushState(null, '', `/document/${ID}`);
      openInPlace(ID);
    });
    goBack();
    expect(screen.getByTestId('explorer')).toBeTruthy();
    expect(screen.queryByTestId('editor')).not.toBeNull();
    expect(editorShown()).toBe(false);

    settled.value = true;
    act(() => {
      vi.advanceTimersByTime(IN_PLACE_SETTLE_POLL_MS);
    });
    expect(screen.queryByTestId('editor')).toBeNull();
  });

  it('lets a settled editor go at once on Back', () => {
    settled.value = true;
    mount();
    act(() => {
      window.history.pushState(null, '', `/document/${ID}`);
      openInPlace(ID);
    });
    goBack();
    expect(screen.queryByTestId('editor')).toBeNull();
  });

  it('shows the kept editor again on Forward', () => {
    mount();
    act(() => {
      window.history.pushState(null, '', `/document/${ID}`);
      openInPlace(ID);
    });
    goBack();
    act(() => {
      window.history.replaceState(null, '', `/document/${ID}`);
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(editorShown()).toBe(true);
  });
});
