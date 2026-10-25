// The better-auth instance for one request (docs/specs/014-identity/blueprints/auth-and-guest-access.md "The
// instance"). Built per request, never cached per isolate: a cached instance whose first request is aborted hangs
// every later request in that isolate (better-auth #10315, #11651), and with the runtime schema check off a build
// costs 2 to 3 ms. The schema is checked in CI instead (identity-schema.test.ts).
//
// better-auth swallows whatever its code-sending callback throws and answers success, so a failed send is recorded
// on the request's `CodeSend` instead, and routes/auth.ts turns it into 502 EMAIL_SEND_FAILED.
//
// Every setting better-auth would otherwise take from NODE_ENV (the secret guard, Secure cookies, its rate limiter)
// is set explicitly: a deployed Worker has no NODE_ENV.
import { betterAuth, type BetterAuthOptions } from 'better-auth';
import { emailOTP } from 'better-auth/plugins/email-otp';
import { jwt } from 'better-auth/plugins/jwt';
import { generateAccountId } from './account-id';
import { identityConfigOf, reportIdentityConfig, versionedSecrets } from './identity-config';
import { identityHooks, sendSignInCode } from './identity-hooks';
import type { Env } from '../types';

// Sessions last 30 days and slide forward at most once a day (blueprint "Constants"; D15).
export const SESSION_EXPIRES_IN_S = 2_592_000;
export const SESSION_UPDATE_AGE_S = 86_400;
// How recent a sign-in must be for the dangerous things (spec "Sessions": 10 minutes).
export const FRESH_SESSION_AGE_S = 600;
// The session token's life (better-auth's jwt default, 15 minutes).
export const SESSION_TOKEN_TTL_S = 900;
// The session-token key rotates every 90 days and the old one verifies for 30 more (D18).
export const JWKS_ROTATION_S = 7_776_000;
export const JWKS_GRACE_S = 2_592_000;
export const EMAIL_CODE_LENGTH = 6;
export const EMAIL_CODE_TTL_S = 300;
export const EMAIL_CODE_ATTEMPTS = 3;

const MODEL_NAMES = {
  user: 'identity_users',
  session: 'identity_sessions',
  account: 'identity_accounts',
  verification: 'identity_verifications',
  jwks: 'identity_jwks',
} as const;

const ID_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

// Ids for every model but the account: 32 random base62 characters, better-auth's own shape.
function randomId(): string {
  let out = '';
  while (out.length < 32) {
    for (const byte of crypto.getRandomValues(new Uint8Array(32))) {
      if (byte < 248 && out.length < 32) out += ID_ALPHABET[byte % 62];
    }
  }
  return out;
}

export type ExecutionContextLike = { waitUntil: (promise: Promise<unknown>) => void };

// One request's code send: whether it failed (see the note at the top).
export type CodeSend = { failed: boolean };

// The options, separate from the instance so the schema generator (scripts/identity-schema.mts) reads exactly
// what the worker runs.
export function identityOptions(
  env: Env,
  executionCtx?: ExecutionContextLike,
  codeSend: CodeSend = { failed: false },
): BetterAuthOptions {
  const { origin, secret, googleClientId } = identityConfigOf(env);
  if (!origin || !secret) throw new Error('identityOptions: sign-in is off on this host');
  const rotated = versionedSecrets(env);
  return {
    appName: 'LiveDoc',
    baseURL: origin,
    basePath: '/api/auth',
    ...(rotated.length > 0 ? { secrets: rotated } : { secret }),
    trustedOrigins: [origin],
    database: env.DB,
    telemetry: { enabled: false },
    rateLimit: { enabled: false },
    user: { modelName: MODEL_NAMES.user, deleteUser: { enabled: false } },
    session: {
      modelName: MODEL_NAMES.session,
      expiresIn: SESSION_EXPIRES_IN_S,
      updateAge: SESSION_UPDATE_AGE_S,
      // better-auth's own freshness check stays off: it would refuse listing sessions too. LiveDoc gates the
      // dangerous routes itself, on FRESH_SESSION_AGE_S (routes/auth.ts, routes/account.ts).
      freshAge: 0,
    },
    account: {
      modelName: MODEL_NAMES.account,
      encryptOAuthTokens: true,
      accountLinking: {
        enabled: true,
        allowDifferentEmails: false,
        requireLocalEmailVerified: true,
        updateUserInfoOnLink: false,
      },
    },
    verification: { modelName: MODEL_NAMES.verification },
    socialProviders: googleClientId
      ? {
          google: {
            clientId: googleClientId,
            clientSecret: env.GOOGLE_AUTH_CLIENT_SECRET!.trim(),
            prompt: 'select_account' as const,
            // better-auth's default scopes are openid, email and profile: who the person is, nothing more.
            // Naming them again would send each twice.
          },
        }
      : {},
    advanced: {
      cookiePrefix: 'livedoc',
      // Explicit: better-auth turns both checks off by itself under a test runner.
      disableOriginCheck: false,
      disableCSRFCheck: false,
      useSecureCookies: !origin.startsWith('http://'),
      ipAddress: { disableIpTracking: true },
      database: {
        validateSchema: false,
        generateId: ({ model }: { model: string }) =>
          model === 'user' || model === MODEL_NAMES.user ? generateAccountId() : randomId(),
      },
    },
    databaseHooks: identityHooks(env, executionCtx),
    plugins: [
      emailOTP({
        otpLength: EMAIL_CODE_LENGTH,
        expiresIn: EMAIL_CODE_TTL_S,
        allowedAttempts: EMAIL_CODE_ATTEMPTS,
        storeOTP: 'hashed',
        sendVerificationOTP: async ({ email, otp }) => {
          if (!(await sendSignInCode(env, { email, otp }))) codeSend.failed = true;
        },
      }),
      jwt({
        schema: { jwks: { modelName: MODEL_NAMES.jwks } },
        jwks: {
          keyPairConfig: { alg: 'EdDSA', crv: 'Ed25519' },
          rotationInterval: JWKS_ROTATION_S,
          gracePeriod: JWKS_GRACE_S,
        },
        jwt: {
          issuer: origin,
          audience: origin,
          expirationTime: `${SESSION_TOKEN_TTL_S}s`,
          definePayload: ({ user, session }) => ({
            email: user.email,
            email_verified: user.emailVerified,
            auth_time: Math.floor(new Date(session.createdAt).getTime() / 1000),
          }),
        },
      }),
    ],
  };
}

// The part of better-auth the worker uses: its request handler, and reading the session a request carries.
export type Identity = {
  handler: (request: Request) => Promise<Response>;
  api: {
    getSession: (input: { headers: Headers }) => Promise<{ session: { createdAt: Date } } | null>;
  };
};

export function createIdentity(
  env: Env,
  executionCtx?: ExecutionContextLike,
  codeSend?: CodeSend,
): Identity | null {
  const config = identityConfigOf(env);
  reportIdentityConfig(config);
  if (!config.enabled) return null;
  return betterAuth(identityOptions(env, executionCtx, codeSend));
}
