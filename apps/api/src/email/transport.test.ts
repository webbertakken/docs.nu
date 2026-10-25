import { afterEach, describe, expect, it, vi } from 'vitest';
import { sqliteD1 } from '../test-sqlite-d1';
import type { Env } from '../types';
import { deliver, emailTransportKind, EMAIL_SEND_TIMEOUT_MS } from './transport';

const MSG = {
  from: 'LiveDoc <hello@docs.nu>',
  to: 'Ada@Example.com',
  subject: 'S',
  html: '<p>h</p>',
};

afterEach(() => vi.unstubAllGlobals());

describe('emailTransportKind', () => {
  it('prefers the outbox, then the Cloudflare binding, then Resend', () => {
    const binding = { send: vi.fn(async () => ({ messageId: 'm' })) };
    expect(
      emailTransportKind({
        EMAIL_OUTBOX: '1',
        EMAIL: binding,
        RESEND_API_KEY: 'r',
      } as unknown as Env),
    ).toBe('outbox');
    expect(emailTransportKind({ EMAIL: binding, RESEND_API_KEY: 'r' } as unknown as Env)).toBe(
      'cloudflare',
    );
    expect(emailTransportKind({ RESEND_API_KEY: 'r' } as unknown as Env)).toBe('resend');
    expect(emailTransportKind({ RESEND_API_KEY: '' } as unknown as Env)).toBeNull();
    expect(emailTransportKind({ EMAIL_OUTBOX: '0' } as unknown as Env)).toBeNull();
  });
});

describe('deliver', () => {
  it('keeps the message in the outbox, addressed in lower case', async () => {
    const { env, sql } = sqliteD1({ EMAIL_OUTBOX: '1' });
    expect(await deliver(env, { ...MSG, text: 't' })).toEqual({ ok: true });
    expect(sql.prepare('SELECT to_address, subject, text FROM email_outbox').get()).toEqual({
      to_address: 'ada@example.com',
      subject: 'S',
      text: 't',
    });
  });

  it('sends through the Cloudflare binding, text and headers included', async () => {
    const send = vi.fn(async () => ({ messageId: 'm' }));
    expect(
      await deliver({ EMAIL: { send } } as unknown as Env, {
        ...MSG,
        text: 't',
        headers: { 'List-Unsubscribe': '<u>' },
      }),
    ).toEqual({
      ok: true,
    });
    expect(send).toHaveBeenCalledWith({
      ...MSG,
      text: 't',
      headers: { 'List-Unsubscribe': '<u>' },
    });
    await deliver({ EMAIL: { send } } as unknown as Env, MSG);
    expect(send).toHaveBeenLastCalledWith(MSG);
  });

  it('answers the Cloudflare error code, or network for anything else thrown', async () => {
    const coded = {
      send: async () =>
        Promise.reject(Object.assign(new Error('x'), { code: 'E_SENDER_NOT_VERIFIED' })),
    };
    expect(await deliver({ EMAIL: coded } as unknown as Env, MSG)).toEqual({
      ok: false,
      status: 'E_SENDER_NOT_VERIFIED',
    });
    const plain = { send: async () => Promise.reject(new Error('x')) };
    expect(await deliver({ EMAIL: plain } as unknown as Env, MSG)).toEqual({
      ok: false,
      status: 'network',
    });
  });

  it('posts to Resend, with a timeout, and answers its status on refusal', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const timeout = vi.spyOn(AbortSignal, 'timeout');
    expect(
      await deliver({ RESEND_API_KEY: 're_x' } as unknown as Env, {
        ...MSG,
        text: 't',
        headers: { a: 'b' },
      }),
    ).toEqual({ ok: true });
    expect(timeout).toHaveBeenCalledWith(EMAIL_SEND_TIMEOUT_MS);
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({
      ...MSG,
      to: ['Ada@Example.com'],
      text: 't',
      headers: { a: 'b' },
    });
    fetchMock.mockResolvedValueOnce(new Response('no', { status: 422 }));
    expect(await deliver({ RESEND_API_KEY: 're_x' } as unknown as Env, MSG)).toEqual({
      ok: false,
      status: '422',
    });
  });

  it('answers not_configured with no transport', async () => {
    expect(await deliver({} as unknown as Env, MSG)).toEqual({
      ok: false,
      status: 'not_configured',
    });
  });
});
