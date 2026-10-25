// Reading and ending the browser's session (docs/specs/014-identity/auth-and-guest-access.md "Sessions"), over
// plain `fetch` against the api's `/api/auth/*`: no auth library rides a page's first load. The session cookie is
// host-only and read only by the api, so these calls stay same-origin; a page served from another origin than its
// api simply reads as signed out.

export type AccountUser = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  // The account's picture URL (a Google picture for a Google sign-in), or null.
  image: string | null;
  createdAt: Date | null;
};

export type SessionState =
  // `/api/auth/*` answers 404: this host runs guest-only.
  | { status: 'off' }
  | { status: 'signed-out' }
  | { status: 'signed-in'; user: AccountUser; sessionCreatedAt: Date | null }
  // The api could not be asked (offline, a 5xx, a body that is not a session). Retried by the caller.
  | { status: 'unreachable' };

export type ApiOptions = {
  // The api's base, as the app's api client uses it (`/api`, or `''` for a bare origin).
  apiBase: string;
  fetch?: typeof fetch;
};

export function authUrl(apiBase: string, path: string): string {
  return `${apiBase}/auth/${path}`;
}

export async function readSession({
  apiBase,
  fetch: fetchImpl = fetch,
}: ApiOptions): Promise<SessionState> {
  let res: Response;
  try {
    res = await fetchImpl(authUrl(apiBase, 'get-session'), {
      cache: 'no-store',
      credentials: 'same-origin',
    });
  } catch {
    return { status: 'unreachable' };
  }
  if (res.status === 404) return { status: 'off' };
  if (res.status === 401) return { status: 'signed-out' };
  if (!res.ok) return { status: 'unreachable' };
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return { status: 'unreachable' };
  }
  if (body === null) return { status: 'signed-out' };
  return sessionOf(body) ?? { status: 'unreachable' };
}

function sessionOf(body: unknown): SessionState | null {
  const { user, session } = body as {
    user?: Record<string, unknown>;
    session?: Record<string, unknown>;
  };
  if (!user || typeof user.id !== 'string' || typeof user.email !== 'string') return null;
  return {
    status: 'signed-in',
    user: {
      id: user.id,
      name: typeof user.name === 'string' ? user.name : '',
      email: user.email,
      emailVerified: user.emailVerified === true,
      image: typeof user.image === 'string' && user.image !== '' ? user.image : null,
      createdAt: dateOf(user.createdAt),
    },
    sessionCreatedAt: dateOf(session?.createdAt),
  };
}

function dateOf(value: unknown): Date | null {
  if (typeof value !== 'string') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

// Ends this browser's session at the api. True when the api confirmed it; false when it could not be reached or
// refused, in which case the cookie may still be live and the caller says so rather than pretending.
export async function signOut({ apiBase, fetch: fetchImpl = fetch }: ApiOptions): Promise<boolean> {
  try {
    const res = await fetchImpl(authUrl(apiBase, 'sign-out'), {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    return res.ok;
  } catch {
    return false;
  }
}
