// A bug report's screenshot (docs/specs/016-platform/bug-reports.md "Filing" step 4, "Screenshots"): checked by its
// bytes' signature, kept in its own R2 bucket under the reporter's tag, served only to the Bug Tracker's owner, and
// deleted with the reporter's account. The bucket's lifecycle rule expires every object after 90 days.
import {
  base64ToBytes,
  sniffImageType,
  type BugReporter,
  type BugReportScreenshot,
  type BugReportScreenshotType,
} from '@livedoc/api-schema';
import { getDocument } from '../db';
import { notFound } from '../responses';
import type { RouteContext } from '../routes/context';
import type { Env } from '../types';
import { reporterTag, resolveBugReporter } from './reporter';

// Every screenshot's key starts here, so a bucket shared with other objects (a preview's) keeps them apart.
const PREFIX = 'bug-reports/';

const EXTENSION: Readonly<Record<BugReportScreenshotType, string>> = {
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
  'image/png': 'png',
};

// `<tag>/<uuid>.<ext>`: what a card's link and the GET route name.
export const SCREENSHOT_KEY_PATTERN =
  /^(?:anonymous|[0-9a-f]{32})\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:webp|jpg|png)$/;

export type ScreenshotPut =
  | { kind: 'stored'; key: string }
  | { kind: 'mismatch' }
  | { kind: 'unstored'; why: 'no_bucket' | 'put_failed' };

export async function putBugScreenshot(
  env: Env,
  reporter: BugReporter,
  screenshot: BugReportScreenshot,
): Promise<ScreenshotPut> {
  const bytes = base64ToBytes(screenshot.data);
  if (!bytes || sniffImageType(bytes) !== screenshot.contentType) return { kind: 'mismatch' };
  if (!env.BUG_SCREENSHOTS) return { kind: 'unstored', why: 'no_bucket' };
  const key = `${await reporterTag(reporter)}/${crypto.randomUUID()}.${EXTENSION[screenshot.contentType]}`;
  try {
    await env.BUG_SCREENSHOTS.put(`${PREFIX}${key}`, bytes, {
      httpMetadata: { contentType: screenshot.contentType },
    });
  } catch (error) {
    console.error('[bug-reports] screenshot.put-failed', { error: String(error) });
    return { kind: 'unstored', why: 'put_failed' };
  }
  return { kind: 'stored', key };
}

// The Bug Tracker's owner, by the request's verified identity; anyone else, and every miss, is the same 404.
export async function serveBugScreenshot(ctx: RouteContext): Promise<Response> {
  const { env, segments } = ctx;
  const key = segments.slice(3).join('/');
  const refuse = (why: string) => {
    console.info('[bug-reports] screenshot.refused', { why });
    return notFound();
  };
  if (!SCREENSHOT_KEY_PATTERN.test(key)) return refuse('malformed');
  if (!env.BUG_REPORT_DOCUMENT_ID || !env.BUG_SCREENSHOTS) return refuse('unconfigured');
  const viewer = await resolveBugReporter(ctx);
  const tracker = await getDocument(env, env.BUG_REPORT_DOCUMENT_ID);
  if (!tracker || viewer.id === null || viewer.id !== tracker.ownerId) return refuse('not_owner');
  const object = await env.BUG_SCREENSHOTS.get(`${PREFIX}${key}`);
  if (!object) return refuse('missing');
  console.info('[bug-reports] screenshot.served');
  return new Response(object.body, {
    headers: {
      'Content-Type': object.httpMetadata?.contentType ?? 'application/octet-stream',
      'Cache-Control': 'private, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'",
    },
  });
}

// Every screenshot the reporter sent, filed or not; answers how many went.
export async function deleteBugScreenshotsOf(env: Env, ownerId: string): Promise<number> {
  if (!env.BUG_SCREENSHOTS) return 0;
  const prefix = `${PREFIX}${await reporterTag({ kind: 'guest', id: ownerId })}/`;
  let deleted = 0;
  let cursor: string | undefined;
  do {
    const page = await env.BUG_SCREENSHOTS.list({ prefix, ...(cursor ? { cursor } : {}) });
    const keys = page.objects.map((o) => o.key);
    if (keys.length) await env.BUG_SCREENSHOTS.delete(keys);
    deleted += keys.length;
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  console.info('[bug-reports] erasure.screenshots', { objects: deleted });
  return deleted;
}
