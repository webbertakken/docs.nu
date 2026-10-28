import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiListCommentThreads } from './comments';

// The thread list the Inbox's reading pane reads (docs/specs/013-workspace/inbox.md §1.4, §1.5): the document's
// threads at a status, through the reader's share code, and a refusal thrown, never read as no threads.

function stub(response: () => Promise<Response>) {
  const fetch = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(response);
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

afterEach(() => vi.unstubAllGlobals());

const thread = {
  tabId: 't1',
  tabName: 'Flow',
  elementId: 'e1',
  ref: 'shape:e1',
  label: 'Checkout',
  resolved: false,
  comments: [{ id: 'c1', text: 'Hi', createdAt: 1, authorName: 'Priya', authorColor: '#336699' }],
};

describe('apiListCommentThreads', () => {
  it('reads the threads at a status through the share code', async () => {
    const fetch = stub(async () => Response.json({ threads: [thread] }));
    expect(await apiListCommentThreads('me', 'd/1', 'open', 'code-1')).toEqual([thread]);
    const [url, init] = fetch.mock.calls[0]!;
    const sent = new URL(String(url), 'https://x.test');
    expect(sent.pathname).toBe('/api/documents/d%2F1/comments');
    expect(sent.searchParams.get('status')).toBe('open');
    expect(new Headers(init?.headers).get('X-Share-Code')).toBe('code-1');
  });

  it('throws on a refusal', async () => {
    stub(async () => Response.json({ error: 'forbidden' }, { status: 403 }));
    await expect(apiListCommentThreads('me', 'd1', 'open')).rejects.toThrow();
  });
});
