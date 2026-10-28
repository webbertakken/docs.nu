import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../types';

// Route-entry guards in routes/context.ts: identity resolution + the
// owner/share authorisation ladder (400 no-owner, 404 missing,
// 403 foreign), plus the header readers. The 404-before-403 ordering is
// a deliberate access-trust property (a foreign id can't be distinguished
// from a missing one until ownership is proven), so it's worth pinning.

const { db } = vi.hoisted(() => ({
  db: {
    getDocument: vi.fn(),
    getMembership: vi.fn(),
    getTrashedDocumentMeta: vi.fn(async () => null),
  },
}));
vi.mock('../db', () => db);

const { access } = vi.hoisted(() => ({
  access: { canReadDocument: vi.fn(), canEditDocument: vi.fn(), resolveDocumentGrant: vi.fn() },
}));
vi.mock('../auth/document-access', () => access);

import type { RouteContext } from './context';
import { ownsDocument, readOptionalBody, requireOwner, sharePasswordOf } from './context';

function makeCtx(
  opts: { owner?: string | null; headers?: Record<string, string> } = {},
): RouteContext {
  const owner = opts.owner === undefined ? 'owner-1' : opts.owner;
  const url = new URL('https://api.test/api/documents/d1');
  const request = new Request(url, { headers: opts.headers ?? {} });
  return {
    request,
    env: {} as Env,
    url,
    segments: url.pathname.replace(/^\//, '').split('/'),
    sessionAccountId: null,
    verifiedAccountId: null,
    accountEmail: null,
    resolveOwner: () => owner,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('sharePasswordOf', () => {
  // The attempt carries the caller's network, whose guessing budget a check
  // spends (docs/specs/013-workspace/share-password.md).
  it('reads the X-Share-Password header with the caller network, else null', () => {
    const request = makeCtx({
      headers: { 'X-Share-Password': 'hunter2', 'CF-Connecting-IP': '2001:db8:0:1::5' },
    }).request;
    expect(sharePasswordOf(request)).toEqual({
      value: 'hunter2',
      rateKey: '2001:0db8:0000:0001::/64',
    });
    expect(sharePasswordOf(makeCtx().request)).toBeNull();
  });
});

describe('requireOwner', () => {
  it('returns the resolved owner id', () => {
    expect(requireOwner(makeCtx({ owner: 'owner-1' }))).toBe('owner-1');
  });

  it('returns a 400 response when no caller is identified', () => {
    const out = requireOwner(makeCtx({ owner: null }));
    expect(out).toBeInstanceOf(Response);
    expect((out as Response).status).toBe(400);
  });
});

describe('ownsDocument', () => {
  it('requires a verified account id for a team document, not the header', async () => {
    db.getMembership.mockResolvedValue({ status: 'joined' });
    const team = { ownerId: 'user_owner', teamId: 'team-1' };
    expect(await ownsDocument(makeCtx({ owner: 'user_owner' }), team)).toBe(false);
    expect(
      await ownsDocument({ ...makeCtx({ owner: null }), verifiedAccountId: 'user_owner' }, team),
    ).toBe(true);
  });

  it('requires the owner of a team document to still be a joined member', async () => {
    db.getMembership.mockResolvedValue(null);
    const team = { ownerId: 'user_owner', teamId: 'team-1' };
    expect(
      await ownsDocument({ ...makeCtx({ owner: null }), verifiedAccountId: 'user_owner' }, team),
    ).toBe(false);
  });

  it('accepts the hybrid identity for a personal document', async () => {
    const personal = { ownerId: 'guest-uuid', teamId: null };
    expect(await ownsDocument(makeCtx({ owner: 'guest-uuid' }), personal)).toBe(true);
    expect(await ownsDocument(makeCtx({ owner: 'someone-else' }), personal)).toBe(false);
  });

  it('is false when neither identity resolves', async () => {
    expect(await ownsDocument(makeCtx({ owner: null }), { ownerId: 'x', teamId: null })).toBe(
      false,
    );
    expect(await ownsDocument(makeCtx({ owner: null }), { ownerId: 'x', teamId: 't' })).toBe(false);
  });
});

describe('readOptionalBody', () => {
  const post = (body: BodyInit | null) =>
    new Request('https://api.test/x', { method: 'POST', body });

  // A body that broke off mid-read (a client gone mid-upload).
  function brokenOff(): Request {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"password":'));
        controller.error(new Error('connection reset'));
      },
    });
    return new Request('https://api.test/x', {
      method: 'POST',
      body: stream,
      // @ts-expect-error -- undici needs `duplex` for a streamed body; the DOM RequestInit type does not name it.
      duplex: 'half',
    });
  }

  it('reads an absent or empty body as no fields', async () => {
    expect(await readOptionalBody(post(null))).toEqual({});
    expect(await readOptionalBody(post('  '))).toEqual({});
  });

  it('reads a JSON object, and any other JSON value as no fields', async () => {
    expect(await readOptionalBody(post('{"role":"view"}'))).toEqual({ role: 'view' });
    expect(await readOptionalBody(post('null'))).toEqual({});
    expect(await readOptionalBody(post('[1]'))).toEqual({});
  });

  it('answers 400 for a body cut short of valid JSON, never no fields', async () => {
    const answer = await readOptionalBody(post('{"password":'));
    expect(answer).toBeInstanceOf(Response);
    expect((answer as Response).status).toBe(400);
  });

  it('answers 400 for a body whose stream broke off, never no fields', async () => {
    const answer = await readOptionalBody(brokenOff());
    expect(answer).toBeInstanceOf(Response);
    expect((answer as Response).status).toBe(400);
    expect(await (answer as Response).json()).toMatchObject({ error: 'body_unreadable' });
  });
});
