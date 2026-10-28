// The comment endpoints (docs/specs/024-agents/agent-presence.md "Comments"): append, delete your own, resolve or
// reopen a thread, and list a document's threads. The editor's view-role path and the Inbox's reading pane
// (docs/specs/013-workspace/inbox.md §1.5) both go through them.
import {
  type CommentListStatus,
  type DocumentCommentThread,
  type DocumentCommentsResponse,
} from '@livedoc/api-schema';
import type { CommentMention } from '@livedoc/document';
import { API_BASE, apiFetch, apiHeaders, expectOk, expectOkVoid } from './core';

// Append a comment to one element's thread on a specific tab.
// View-role visitors can call this (the only write path open to
// them): owner / edit-role visitors also could but already get
// the same write via the tab autosave, so the editor only invokes
// this for view-role sessions so a viewer's contribution actually
// persists. Returns the freshly-created comment so the caller can
// merge it into local state without a tab refetch.
export async function apiAddComment(
  ownerId: string,
  documentId: string,
  tabId: string,
  elementId: string,
  text: string,
  shareCode: string | null = null,
  // Teammates the comment @-tags (docs/specs/012-collaboration/comment-mentions.md); cleaned server-side.
  mentions?: CommentMention[],
  // A Sheet cell's thread (docs/specs/029-sheets/sheet.md "Cell comments"), by its cell key.
  cell?: string,
): Promise<{
  id: string;
  text: string;
  createdAt: number;
  authorName: string;
  authorColor: string;
}> {
  const res = await apiFetch(
    `${API_BASE}/documents/${encodeURIComponent(documentId)}/tabs/${encodeURIComponent(tabId)}/comments`,
    {
      method: 'POST',
      headers: await apiHeaders(ownerId, { share: shareCode, body: true }),
      body: JSON.stringify({
        elementId,
        text,
        ...(mentions?.length ? { mentions } : {}),
        ...(cell !== undefined ? { cell } : {}),
      }),
    },
  );
  return expectOk<{
    comment: {
      id: string;
      text: string;
      createdAt: number;
      authorName: string;
      authorColor: string;
    };
  }>(res, 'add comment').then((b) => b.comment);
}

// Delete a single comment you authored. The server authorises this on
// the comment's stamped authorId === caller, so a view-role visitor can
// remove their OWN comment (the matching write path to apiAddComment)
// without edit rights. Owner / edit-role sessions persist their
// delete-own through the normal tab autosave, so the editor only calls
// this for view-role; deleting someone else's comment still requires
// edit rights via the tab PUT.
export async function apiDeleteComment(
  ownerId: string,
  documentId: string,
  tabId: string,
  commentId: string,
  shareCode: string | null = null,
): Promise<void> {
  const res = await apiFetch(
    `${API_BASE}/documents/${encodeURIComponent(documentId)}/tabs/${encodeURIComponent(tabId)}/comments/${encodeURIComponent(commentId)}`,
    {
      method: 'DELETE',
      headers: await apiHeaders(ownerId, { share: shareCode }),
    },
  );
  await expectOkVoid(res, 'delete comment');
}

// Resolve or reopen a thread through the comment endpoints (docs/specs/024-agents/agent-presence.md "Comments"): the
// path of a session that may comment but not edit, which has no autosave. The thread is named by any of its comments.
export async function apiSetThreadResolved(
  ownerId: string,
  documentId: string,
  tabId: string,
  commentId: string,
  resolved: boolean,
  shareCode: string | null = null,
): Promise<void> {
  const verb = resolved ? 'resolve' : 'reopen';
  const res = await apiFetch(
    `${API_BASE}/documents/${encodeURIComponent(documentId)}/tabs/${encodeURIComponent(tabId)}/comments/${encodeURIComponent(commentId)}/${verb}`,
    { method: 'POST', headers: await apiHeaders(ownerId, { share: shareCode }) },
  );
  await expectOkVoid(res, `${verb} thread`);
}

// A document's comment threads, every tab's, in tab and outline order (GET /api/documents/:id/comments). The
// Inbox reads one thread from it: its comments, and the first one's id, which names the thread to resolve.
export async function apiListCommentThreads(
  ownerId: string,
  documentId: string,
  status: CommentListStatus,
  shareCode: string | null = null,
  signal?: AbortSignal,
): Promise<DocumentCommentThread[]> {
  const res = await apiFetch(
    `${API_BASE}/documents/${encodeURIComponent(documentId)}/comments?status=${status}`,
    { headers: await apiHeaders(ownerId, { share: shareCode }), signal },
  );
  return expectOk<DocumentCommentsResponse>(res, 'list comments').then((b) =>
    Array.isArray(b.threads) ? b.threads : [],
  );
}
