// docs/specs/014-identity/transactional-email.md: the product's email. Gated on a configured transport
// (email/transport.ts: the outbox, Cloudflare Email Service, or Resend): with none, every send is a no-op and the
// lifecycle table is never touched, so a deployment with email off does zero extra work. `sendEmail` is
// best-effort and never throws, so a failure can't fail or delay the request that triggered it (callers run it in
// ctx.waitUntil or the daily cron). `sendEmailNow` is for sign-in codes, whose failure the person must see.

import type { Env } from '../types';
import { reportServerEvent } from '../server-telemetry';
import type { EmailKind } from './templates';
import { deliver, emailTransportKind, type SendOutcome } from './transport';

export { EMAIL_SEND_TIMEOUT_MS } from './transport';

const DEFAULT_FROM = 'LiveDoc <hello@docs.nu>';
const DEFAULT_BASE_URL = 'https://docs.nu';

export function emailEnabled(env: Env): boolean {
  return emailTransportKind(env) !== null;
}

// Public origin for links in emails. Trailing slashes stripped so callers can
// always template `${appBaseUrl(env)}/path`.
export function appBaseUrl(env: Env): string {
  const base = env.APP_BASE_URL ?? DEFAULT_BASE_URL;
  // A reverse scan rather than /\/+$/. That pattern is unanchored, so on a
  // value that does not end in a slash the engine retries from every offset,
  // which is quadratic in the length. This one only ever sees a configured env
  // var, but a linear strip costs nothing and stops the shape being copied.
  let end = base.length;
  while (end > 0 && base.charCodeAt(end - 1) === SLASH) end -= 1;
  return base.slice(0, end);
}

const SLASH = '/'.charCodeAt(0);

type EmailMessage = {
  // Which template this is, for the docs/specs/017-telemetry/telemetry.md 'Email' telemetry below. Comes
  // from the builder's own return, so callers never spell it out.
  kind: EmailKind;
  to: string;
  subject: string;
  html: string;
  // Plain-text alternative; mail clients and screen readers prefer it when present.
  text?: string;
  // For opt-out emails: a URL where the recipient can manage / turn off this
  // category. Emitted as a `List-Unsubscribe` header so mail clients can surface
  // a native unsubscribe affordance (we point it at the profile page rather than
  // a one-click POST endpoint, by design — docs/specs/014-identity/transactional-email.md).
  unsubscribeUrl?: string;
};

// Best-effort send: logs and counts a failure, never throws.
export async function sendEmail(env: Env, msg: EmailMessage): Promise<{ sent: boolean }> {
  if (!emailEnabled(env)) return { sent: false };
  const outcome = await sendEmailNow(env, msg);
  return { sent: outcome.ok };
}

// Send and answer how it went, for a caller that must tell the person (a sign-in code). Never throws either.
export async function sendEmailNow(env: Env, msg: EmailMessage): Promise<SendOutcome> {
  const provider = emailTransportKind(env);
  const outcome = await deliver(env, {
    from: env.EMAIL_FROM ?? DEFAULT_FROM,
    to: msg.to,
    subject: msg.subject,
    html: msg.html,
    ...(msg.text ? { text: msg.text } : {}),
    ...(msg.unsubscribeUrl ? { headers: { 'List-Unsubscribe': `<${msg.unsubscribeUrl}>` } } : {}),
  });
  // One anonymous telemetry row per outcome (docs/specs/017-telemetry/telemetry.md), written server-side
  // because nothing about an email reaches a browser. reportServerEvent gates on TELEMETRY_ENABLED and swallows
  // its own failure.
  if (!outcome.ok) {
    console.error(
      `[email] send failed provider=${provider} status=${outcome.status} kind=${msg.kind} to=${redact(msg.to)}`,
    );
    await reportServerEvent(env, 'Error', 'Api', sendFailureType(outcome.status));
    return outcome;
  }
  await reportServerEvent(env, 'Email', 'Sent', msg.kind);
  return outcome;
}

// The telemetry type of a failed send: `Http<status>.SendEmail` for an HTTP answer, `Network.SendEmail` when
// nothing answered, `<code>.SendEmail` for a provider error code (Cloudflare's `E_…`).
function sendFailureType(status: string): string {
  if (/^\d{3}$/.test(status)) return `Http${status}.SendEmail`;
  if (status === 'network') return 'Network.SendEmail';
  return `${status}.SendEmail`;
}

// Log addresses partially so `wrangler tail` stays useful without dumping full
// emails into the log stream.
function redact(email: string): string {
  const at = email.indexOf('@');
  if (at < 1) return '***';
  return `${email.slice(0, 2)}***${email.slice(at)}`;
}
