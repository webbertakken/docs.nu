import { afterEach, describe, expect, it, vi } from 'vitest';

const client = vi.hoisted(() => ({
  updateUser: vi.fn(),
  listAccounts: vi.fn(),
  linkSocial: vi.fn(),
  unlinkAccount: vi.fn(),
  listSessions: vi.fn(),
  getSession: vi.fn(),
  revokeSession: vi.fn(),
  revokeOtherSessions: vi.fn(),
}));
vi.mock('./auth-client', () => ({ authClient: client }));

const {
  connectGoogle,
  readAccountSessions,
  readGoogleAccount,
  removeGoogle,
  saveAccountName,
  signOutOtherSessions,
  signOutSession,
} = await import('./account-manage');

const ok = (data: unknown = {}) => ({ data, error: null });
const fail = (status: number, code?: string) => ({ data: null, error: { status, code } });

afterEach(() => vi.clearAllMocks());

describe('account-manage', () => {
  it('saves a trimmed name, and refuses a blank or overlong one without asking', async () => {
    client.updateUser.mockResolvedValue(ok());
    expect(await saveAccountName('  Ada  ')).toBe(true);
    expect(client.updateUser).toHaveBeenCalledWith({ name: 'Ada' });
    expect(await saveAccountName('   ')).toBe(false);
    expect(await saveAccountName('x'.repeat(101))).toBe(false);
    expect(client.updateUser).toHaveBeenCalledTimes(1);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    client.updateUser.mockResolvedValue(fail(500));
    expect(await saveAccountName('Ada')).toBe(false);
  });

  it('finds the linked Google method, or none, or answers null when unreadable', async () => {
    client.listAccounts.mockResolvedValueOnce(ok([{ id: 'a1', providerId: 'google' }]));
    expect(await readGoogleAccount()).toBe('a1');
    client.listAccounts.mockResolvedValueOnce(ok([]));
    expect(await readGoogleAccount()).toBe(false);
    client.listAccounts.mockResolvedValueOnce(fail(500));
    expect(await readGoogleAccount()).toBeNull();
  });

  it('names a refusal for freshness apart from any other failure', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    client.unlinkAccount.mockResolvedValueOnce(ok());
    expect(await removeGoogle('a1')).toBe('done');
    expect(client.unlinkAccount).toHaveBeenCalledWith({ accountId: 'a1' });
    client.unlinkAccount.mockResolvedValueOnce(fail(403, 'SESSION_NOT_FRESH'));
    expect(await removeGoogle('a1')).toBe('not_fresh');
    client.linkSocial.mockResolvedValueOnce(fail(400));
    expect(await connectGoogle('/explorer')).toBe('failed');
    expect(client.linkSocial).toHaveBeenCalledWith({
      provider: 'google',
      callbackURL: '/explorer',
    });
  });

  it('lists sessions newest first, named, with this one marked', async () => {
    client.listSessions.mockResolvedValue(
      ok([
        { token: 'old', userAgent: 'Firefox/144.0 (Windows NT 10.0)', updatedAt: '2026-10-01' },
        { token: 'me', userAgent: 'Chrome/141.0 (X11; Linux x86_64)', updatedAt: '2026-10-25' },
      ]),
    );
    client.getSession.mockResolvedValue(ok({ session: { token: 'me' } }));
    expect(await readAccountSessions()).toEqual([
      { token: 'me', label: 'Chrome on Linux', lastActive: new Date('2026-10-25'), current: true },
      {
        token: 'old',
        label: 'Firefox on Windows',
        lastActive: new Date('2026-10-01'),
        current: false,
      },
    ]);
    client.listSessions.mockResolvedValue(fail(500));
    expect(await readAccountSessions()).toBeNull();
  });

  it('signs one session out, or all the others', async () => {
    client.revokeSession.mockResolvedValue(ok());
    client.revokeOtherSessions.mockResolvedValue(fail(500));
    expect(await signOutSession('old')).toBe(true);
    expect(client.revokeSession).toHaveBeenCalledWith({ token: 'old' });
    expect(await signOutOtherSessions()).toBe(false);
  });
});
