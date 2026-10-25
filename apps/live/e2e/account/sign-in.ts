import { randomUUID } from 'node:crypto';
import type { APIRequestContext, BrowserContext } from '@playwright/test';
import { expect } from '../fixtures';

// Signing in for real on the e2e stack (docs/specs/003-system-architecture/e2e-smoke.md "Signed-in specs";
// docs/specs/014-identity/auth-and-guest-access.md "Sign-in methods"): an email code sent through better-auth,
// read back from the stack's outbox (EMAIL_OUTBOX=1, GET /api/preview/outbox), and exchanged for the session
// cookie, which lands in the browser context, so every page the context opens is signed in. The session token
// the browser would send (`GET /api/auth/token`) seeds data through the api as that account.

// Must match CLIENT_ADDRESS_COOKIE in scripts/e2e-stack.mjs, which forwards it as CF-Connecting-IP.
const CLIENT_ADDRESS_COOKIE = 'e2e-client-address';
// The session cookie's name (better-auth's `session_token` under the api's `livedoc` cookie prefix).
const SESSION_COOKIE = /^livedoc\./;
const SIGN_IN_CODE = /^(\d{6}) /;

export type SignInOptions = {
  // The run's base URL (the `baseURL` fixture): the live origin, which better-auth checks every POST against.
  baseURL: string;
  // The account's name, set when the address has no account yet.
  name: string;
  // Defaults to a fresh address, so parallel tests on the stack's one D1 never share an account.
  email?: string;
};

export type Account = {
  id: string;
  email: string;
  name: string;
  // The signed-in context's request client: it carries the session cookie and resolves paths on the live origin.
  request: APIRequestContext;
  // A session token for `Authorization: Bearer` (15 minutes; asked afresh on every call).
  sessionToken: () => Promise<string>;
  // The headers a seeding call as this account sends: its session token and the live origin.
  apiHeaders: () => Promise<Record<string, string>>;
  // Signs another browser context in as this account, on the same session.
  enter: (context: BrowserContext) => Promise<void>;
  // Changes the account as Settings would (`POST /api/auth/update-user`): its name, or its picture.
  update: (fields: { name?: string; image?: string | null }) => Promise<void>;
};

// A fresh address for a test account, readable in a failure: `ann-1a2b3c4d5e6f@example.com`.
export function freshEmail(label: string): string {
  const slug =
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'person';
  return `${slug}-${randomUUID().replaceAll('-', '').slice(0, 12)}@example.com`;
}

// Gives the context a client address of its own, as each visitor has one behind Cloudflare. The api rate limits
// sign-in per address, and every request on the stack comes from loopback, so without this the whole suite would
// share one bucket. Idempotent; every context that signs in through the api or the page needs one.
export async function giveOwnClientAddress(
  context: BrowserContext,
  baseURL: string,
): Promise<void> {
  const origin = new URL(baseURL).origin;
  const held = await context.cookies(origin);
  if (held.some((c) => c.name === CLIENT_ADDRESS_COOKIE)) return;
  const octet = () => 1 + Math.floor(Math.random() * 254);
  await context.addCookies([
    {
      name: CLIENT_ADDRESS_COOKIE,
      value: `10.${octet()}.${octet()}.${octet()}`,
      url: origin,
    },
  ]);
}

// The newest sign-in code the outbox holds for `email` that was sent at or after `since`.
export async function readSignInCode(
  request: APIRequestContext,
  baseURL: string,
  email: string,
  since: number,
): Promise<string> {
  const origin = new URL(baseURL).origin;
  let code: string | null = null;
  await expect
    .poll(
      async () => {
        const res = await request.get(
          `${origin}/api/preview/outbox?to=${encodeURIComponent(email)}`,
        );
        if (!res.ok()) return `outbox ${res.status()}`;
        const mail = (await res.json()) as { subject: string; createdAt: number };
        const match = SIGN_IN_CODE.exec(mail.subject);
        if (!match || mail.createdAt < since) return 'no new code yet';
        code = match[1]!;
        return 'code';
      },
      { message: `a sign-in code for ${email} in the outbox` },
    )
    .toBe('code');
  return code!;
}

// Asks for a sign-in code for `email` and returns it, as the person reading their mailbox would.
export async function requestSignInCode(
  context: BrowserContext,
  baseURL: string,
  email: string,
): Promise<string> {
  const origin = new URL(baseURL).origin;
  await giveOwnClientAddress(context, origin);
  const since = Date.now() - 1_000;
  const sent = await context.request.post(`${origin}/api/auth/email-otp/send-verification-otp`, {
    headers: { Origin: origin },
    data: { email, type: 'sign-in' },
  });
  expect(sent.status(), `sending a sign-in code to ${email}`).toBe(200);
  return readSignInCode(context.request, origin, email, since);
}

// Signs `context` in: the code is sent, read from the outbox and entered, and the session cookie lands in the
// context. Signing in with an address that has no account makes one, named `name`.
export async function signIn(context: BrowserContext, options: SignInOptions): Promise<Account> {
  const origin = new URL(options.baseURL).origin;
  const email = options.email ?? freshEmail(options.name);
  const otp = await requestSignInCode(context, origin, email);
  const res = await context.request.post(`${origin}/api/auth/sign-in/email-otp`, {
    headers: { Origin: origin },
    data: { email, otp, name: options.name },
  });
  expect(res.status(), `signing ${email} in`).toBe(200);
  const { user } = (await res.json()) as { user: { id: string; name: string } };
  const session = (await context.cookies(origin)).filter((c) => SESSION_COOKIE.test(c.name));
  expect(session.length, 'the session cookie lands in the browser context').toBeGreaterThan(0);

  const sessionToken = async () => {
    const answer = await context.request.get(`${origin}/api/auth/token`);
    expect(answer.status(), `a session token for ${email}`).toBe(200);
    return ((await answer.json()) as { token: string }).token;
  };
  return {
    id: user.id,
    email,
    name: user.name,
    request: context.request,
    sessionToken,
    apiHeaders: async () => ({ Authorization: `Bearer ${await sessionToken()}`, Origin: origin }),
    enter: async (other) => {
      await giveOwnClientAddress(other, origin);
      await other.addCookies(session);
    },
    update: async (fields) => {
      const res = await context.request.post(`${origin}/api/auth/update-user`, {
        headers: { Origin: origin },
        data: fields,
      });
      expect(res.status(), `updating ${email}`).toBe(200);
    },
  };
}

// The session the api reads from the context's cookie (`GET /api/auth/get-session`): null when signed out.
export async function sessionOf(context: BrowserContext): Promise<{ user: { id: string } } | null> {
  const res = await context.request.get('/api/auth/get-session');
  expect(res.status(), 'reading the session').toBe(200);
  return (await res.json()) as { user: { id: string } } | null;
}
