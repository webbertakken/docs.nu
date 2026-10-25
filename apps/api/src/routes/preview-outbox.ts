// GET /api/preview/outbox?to=<address> (docs/specs/014-identity/auth-and-guest-access.md "Previews"): the newest
// email kept for an address on a host that sends none (`EMAIL_OUTBOX=1`: previews and the local e2e stack), so a
// sign-in code can be read without a mailbox. Absent everywhere else, production included.
import { json, notFound } from '../responses';
import type { Env } from '../types';

export async function handlePreviewOutbox(request: Request, env: Env): Promise<Response> {
  if (env.EMAIL_OUTBOX !== '1') return notFound();
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.pathname.replace(/\/+$/, '') !== '/api/preview/outbox') {
    return notFound();
  }
  const to = url.searchParams.get('to')?.trim().toLowerCase();
  if (!to) return json({ error: 'to is required' }, { status: 400 });
  const row = await env.DB.prepare(
    'SELECT subject, text, created_at AS createdAt FROM email_outbox WHERE to_address = ? ORDER BY id DESC LIMIT 1',
  )
    .bind(to)
    .first<{ subject: string; text: string; createdAt: number }>();
  if (!row) return notFound();
  return json(row, { headers: { 'Cache-Control': 'no-store' } });
}
