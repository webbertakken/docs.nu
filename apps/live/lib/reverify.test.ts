import { beforeEach, describe, expect, it, vi } from 'vitest';

const client = vi.hoisted(() => ({
  emailOtp: { sendVerificationOtp: vi.fn() },
  signIn: { emailOtp: vi.fn() },
}));
vi.mock('@/lib/auth-client', () => ({ authClient: client }));

import { AUTH_ERROR_COPY } from './auth-errors';
import { reverifyWithCode, sendReverifyCode } from './reverify';

beforeEach(() => {
  client.emailOtp.sendVerificationOtp.mockReset();
  client.signIn.emailOtp.mockReset();
});

describe('sendReverifyCode', () => {
  it('sends a sign-in code to the account email', async () => {
    client.emailOtp.sendVerificationOtp.mockResolvedValue({ data: { success: true }, error: null });
    expect(await sendReverifyCode('ada@example.com')).toBeNull();
    expect(client.emailOtp.sendVerificationOtp).toHaveBeenCalledWith({
      email: 'ada@example.com',
      type: 'sign-in',
    });
  });

  it('says why a send failed', async () => {
    client.emailOtp.sendVerificationOtp.mockResolvedValue({
      data: null,
      error: { code: 'EMAIL_SEND_FAILED', status: 502 },
    });
    expect(await sendReverifyCode('ada@example.com')).toBe(AUTH_ERROR_COPY.EMAIL_SEND_FAILED);
    client.emailOtp.sendVerificationOtp.mockRejectedValue(new TypeError('offline'));
    expect(await sendReverifyCode('ada@example.com')).toBe(AUTH_ERROR_COPY.network);
  });
});

describe('reverifyWithCode', () => {
  it('signs in again with the code', async () => {
    client.signIn.emailOtp.mockResolvedValue({ data: { user: {} }, error: null });
    expect(await reverifyWithCode('ada@example.com', '123456')).toBeNull();
    expect(client.signIn.emailOtp).toHaveBeenCalledWith({
      email: 'ada@example.com',
      otp: '123456',
    });
  });

  it('says why the code was refused', async () => {
    client.signIn.emailOtp.mockResolvedValue({
      data: null,
      error: { code: 'INVALID_OTP', status: 400 },
    });
    expect(await reverifyWithCode('ada@example.com', '000000')).toBe(AUTH_ERROR_COPY.INVALID_OTP);
    client.signIn.emailOtp.mockRejectedValue(new TypeError('offline'));
    expect(await reverifyWithCode('ada@example.com', '000000')).toBe(AUTH_ERROR_COPY.network);
  });
});
