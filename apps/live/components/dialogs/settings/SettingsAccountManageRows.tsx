'use client';

// Settings > Account, signed in (docs/specs/014-identity/auth-and-guest-access.md "Account settings"; blueprint
// "Presentation and UX"): the account's name, its sign-in methods and its sessions. Each row only renders signed
// in (the catalogue's `available`), and reads the account through lib/account-manage.ts.
import { useCallback, useEffect, useState } from 'react';
import { TextInput } from '@livediagram/ui';
import { authHrefWithReturn, useAuthReturnPath } from '@/components/chrome/auth-shared';
import { useDeferredAuth } from '@/components/providers/deferred-auth';
import {
  ACCOUNT_NAME_MAX,
  connectGoogle,
  readAccountSessions,
  readGoogleAccount,
  removeGoogle,
  saveAccountName,
  signOutOtherSessions,
  signOutSession,
  type AccountSessionRow,
} from '@/lib/account-manage';
import { useAuthConfig } from '@/lib/auth-config';
import { SETTINGS_ROW_BUTTON, SettingsRowShell } from './SettingsRowShell';
import type {
  SettingsAccountNameRowSpec,
  SettingsSessionsRowSpec,
  SettingsSignInMethodsRowSpec,
} from './settings-catalogue';

export const NAME_SAVED = 'Saved.';
export const NAME_FAILED = "Couldn't save your name. Try again.";
export const LOAD_FAILED = "Couldn't load this. Try again.";
export const NOT_FRESH = 'For your safety, sign in again first.';
export const ACTION_FAILED = "That didn't work. Try again.";

const STATUS = 'mt-1 text-xs text-slate-600 dark:text-slate-300';
const LINK = 'font-medium text-brand-700 underline-offset-2 hover:underline dark:text-brand-400';

export function SettingsAccountNameRow({ row }: { row: SettingsAccountNameRowSpec }) {
  const { user, refreshSession } = useDeferredAuth();
  const saved = user?.name ?? '';
  const [name, setName] = useState(saved);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const changed = name.trim() !== saved && name.trim().length > 0;

  const save = async () => {
    setBusy(true);
    setStatus(null);
    const ok = await saveAccountName(name);
    if (ok) await refreshSession?.();
    setStatus(ok ? NAME_SAVED : NAME_FAILED);
    setBusy(false);
  };

  return (
    <SettingsRowShell
      row={row}
      control={
        <form
          className="flex shrink-0 items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (changed && !busy) void save();
          }}
        >
          <TextInput
            aria-label="Your name"
            value={name}
            maxLength={ACCOUNT_NAME_MAX}
            onChange={(event) => setName(event.target.value)}
            className="w-44"
          />
          <button type="submit" className={SETTINGS_ROW_BUTTON} disabled={!changed || busy}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </form>
      }
    >
      {status ? (
        <p role="status" className={STATUS}>
          {status}
        </p>
      ) : null}
    </SettingsRowShell>
  );
}

function SignInAgain() {
  const returnTo = useAuthReturnPath();
  return (
    <>
      {NOT_FRESH}{' '}
      <a href={authHrefWithReturn('/sign-in/', returnTo)} className={LINK}>
        Sign In Again
      </a>
    </>
  );
}

export function SettingsSignInMethodsRow({ row }: { row: SettingsSignInMethodsRowSpec }) {
  const { user } = useDeferredAuth();
  const { methods } = useAuthConfig();
  const returnTo = useAuthReturnPath();
  const googleOffered = methods.includes('google');
  // The linked Google method's id, false for none, null when unreadable.
  const [google, setGoogle] = useState<string | false | null | 'loading'>('loading');
  const [status, setStatus] = useState<'not_fresh' | 'failed' | null>(null);

  const load = useCallback(async () => {
    setGoogle('loading');
    setGoogle(await readGoogleAccount());
  }, []);
  useEffect(() => {
    if (googleOffered) void load();
  }, [googleOffered, load]);

  const remove = async (accountId: string) => {
    setStatus(null);
    const outcome = await removeGoogle(accountId);
    if (outcome === 'done') setGoogle(false);
    else setStatus(outcome);
  };

  return (
    <SettingsRowShell row={row}>
      <ul className="mt-2 space-y-2 text-sm text-slate-700 dark:text-slate-200">
        <li className="flex items-center justify-between gap-3">
          <span>
            Email code <span className="text-slate-500 dark:text-slate-400">· {user?.email}</span>
          </span>
        </li>
        {googleOffered ? (
          <li className="flex items-center justify-between gap-3">
            <span>
              Google
              {typeof google === 'string' ? (
                <span className="text-slate-500 dark:text-slate-400"> · Connected</span>
              ) : null}
            </span>
            {google === 'loading' ? (
              <span className="text-xs text-slate-500 dark:text-slate-400">Loading…</span>
            ) : google === null ? (
              <button type="button" className={SETTINGS_ROW_BUTTON} onClick={() => void load()}>
                Try Again
              </button>
            ) : typeof google === 'string' ? (
              <button
                type="button"
                className={SETTINGS_ROW_BUTTON}
                onClick={() => void remove(google)}
              >
                Remove
              </button>
            ) : (
              <button
                type="button"
                className={SETTINGS_ROW_BUTTON}
                onClick={() =>
                  void connectGoogle(returnTo).then((outcome) =>
                    setStatus(outcome === 'done' ? null : outcome),
                  )
                }
              >
                Connect Google
              </button>
            )}
          </li>
        ) : null}
      </ul>
      {google === null ? <p className={STATUS}>{LOAD_FAILED}</p> : null}
      {status ? (
        <p role="status" className={STATUS}>
          {status === 'not_fresh' ? <SignInAgain /> : ACTION_FAILED}
        </p>
      ) : null}
    </SettingsRowShell>
  );
}

export function SettingsSessionsRow({ row }: { row: SettingsSessionsRowSpec }) {
  const [sessions, setSessions] = useState<AccountSessionRow[] | null | 'loading'>('loading');
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setSessions('loading');
    setSessions(await readAccountSessions());
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const act = async (work: Promise<boolean>) => {
    setFailed(false);
    if (await work) await load();
    else setFailed(true);
  };

  const others = Array.isArray(sessions) ? sessions.filter((s) => !s.current).length : 0;
  return (
    <SettingsRowShell
      row={row}
      control={
        others > 0 ? (
          <button
            type="button"
            className={SETTINGS_ROW_BUTTON}
            onClick={() => void act(signOutOtherSessions())}
          >
            Sign Out Everywhere Else
          </button>
        ) : undefined
      }
    >
      {sessions === 'loading' ? (
        <p className={STATUS}>Loading…</p>
      ) : sessions === null ? (
        <p className={STATUS}>
          {LOAD_FAILED}{' '}
          <button type="button" className={LINK} onClick={() => void load()}>
            Try Again
          </button>
        </p>
      ) : (
        <ul className="mt-2 space-y-2 text-sm text-slate-700 dark:text-slate-200">
          {sessions.map((session) => (
            <li key={session.token} className="flex items-center justify-between gap-3">
              <span>
                {session.label}
                <span className="block text-xs text-slate-500 dark:text-slate-400">
                  {session.current
                    ? 'This browser'
                    : `Last active ${session.lastActive.toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}`}
                </span>
              </span>
              {session.current ? null : (
                <button
                  type="button"
                  className={SETTINGS_ROW_BUTTON}
                  onClick={() => void act(signOutSession(session.token))}
                  aria-label={`Sign out ${session.label}`}
                >
                  Sign Out
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {failed ? (
        <p role="status" className={STATUS}>
          {ACTION_FAILED}
        </p>
      ) : null}
    </SettingsRowShell>
  );
}
