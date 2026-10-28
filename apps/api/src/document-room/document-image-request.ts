// The drawn images of a document that are served outside its own routes (docs/specs/006-document/
// document-snapshots.md): a share link's live image (`/api/share/:code/image.svg`) and its link-preview card
// (`/api/share/:code/image.png`). The worker resolves the link to its document and hands the request to that
// document's room (`image` RPC), which draws from its own tabs with the same handlers.

import type { DocumentRouteContext } from '../routes/context';
import { handleShareImage } from '../routes/share';
import { shareCardImage } from '../routes/share-preview';
import { notFound } from '../responses';

// The share paths whose answer is drawn from the document's content.
export function isDocumentImagePath(segments: readonly string[]): boolean {
  return (
    segments.length === 4 &&
    segments[1] === 'share' &&
    (segments[3] === 'image.svg' || segments[3] === 'image.png')
  );
}

export async function answerDocumentImage(
  ctx: DocumentRouteContext,
  documentId: string,
): Promise<Response> {
  const { segments, request } = ctx;
  if (!isDocumentImagePath(segments) || request.method !== 'GET') return notFound();
  const code = segments[2]!;
  console.info('[room-image] drawing', { documentId, kind: segments[3] });
  if (segments[3] === 'image.svg') return handleShareImage(ctx, code);
  return shareCardImage(ctx, code);
}
