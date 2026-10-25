// How an email leaves the worker (docs/specs/014-identity/auth-and-guest-access.md "Email for sign-in",
// docs/specs/014-identity/transactional-email.md). One port, three transports, chosen by configuration in this
// order:
//
//   1. the outbox (`EMAIL_OUTBOX=1`): previews and the local e2e stack. Nothing is sent; each message is kept in
//      `email_outbox` for `GET /api/preview/outbox` to read back.
//   2. Cloudflare Email Service, when the `EMAIL` send_email binding exists.
//   3. Resend, when `RESEND_API_KEY` is set.
//
// None of them configured: email is off (`emailTransportKind` is null).
import type { Env } from '../types';

export type EmailTransportKind = 'outbox' | 'cloudflare' | 'resend';

export type OutgoingEmail = {
  from: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
  headers?: Record<string, string>;
};

// `status` is the provider's HTTP status or error code, for logs; never the message.
export type SendOutcome = { ok: true } | { ok: false; status: string };

// The longest a send may wait on a provider, which answers in well under a second. A timed-out send is a failed
// send. Safe range: 3 s to 30 s.
export const EMAIL_SEND_TIMEOUT_MS = 10_000;

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

export function emailTransportKind(env: Env): EmailTransportKind | null {
  if (env.EMAIL_OUTBOX === '1') return 'outbox';
  if (env.EMAIL) return 'cloudflare';
  if (typeof env.RESEND_API_KEY === 'string' && env.RESEND_API_KEY.length > 0) return 'resend';
  return null;
}

// Hand one message to the configured transport. Never throws: every failure is an outcome.
export async function deliver(env: Env, msg: OutgoingEmail): Promise<SendOutcome> {
  const kind = emailTransportKind(env);
  try {
    if (kind === 'outbox') return await toOutbox(env, msg);
    if (kind === 'cloudflare') return await toCloudflare(env, msg);
    if (kind === 'resend') return await toResend(env, msg);
    return { ok: false, status: 'not_configured' };
  } catch (err) {
    const code = (err as { code?: unknown } | null)?.code;
    return { ok: false, status: typeof code === 'string' ? code : 'network' };
  }
}

async function toOutbox(env: Env, msg: OutgoingEmail): Promise<SendOutcome> {
  await env.DB.prepare(
    'INSERT INTO email_outbox (to_address, subject, text, html, created_at) VALUES (?, ?, ?, ?, ?)',
  )
    .bind(msg.to.toLowerCase(), msg.subject, msg.text ?? '', msg.html, Date.now())
    .run();
  return { ok: true };
}

async function toCloudflare(env: Env, msg: OutgoingEmail): Promise<SendOutcome> {
  await env.EMAIL!.send({
    from: msg.from,
    to: msg.to,
    subject: msg.subject,
    html: msg.html,
    ...(msg.text ? { text: msg.text } : {}),
    ...(msg.headers ? { headers: msg.headers } : {}),
  });
  return { ok: true };
}

async function toResend(env: Env, msg: OutgoingEmail): Promise<SendOutcome> {
  const res = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: msg.from,
      to: [msg.to],
      subject: msg.subject,
      html: msg.html,
      ...(msg.text ? { text: msg.text } : {}),
      ...(msg.headers ? { headers: msg.headers } : {}),
    }),
    signal: AbortSignal.timeout(EMAIL_SEND_TIMEOUT_MS),
  });
  return res.ok ? { ok: true } : { ok: false, status: String(res.status) };
}
