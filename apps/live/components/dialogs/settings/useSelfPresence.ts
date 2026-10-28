'use client';

// The person as collaborators see them, for the profile card and the Colour row
// (docs/specs/014-identity/auth-and-guest-access.md "Account settings"): their participant record, read once auth
// has settled (the account's id, else this browser's guest id; a guest id is never minted here), and kept in step
// with a colour picked in Settings.
import { useEffect, useState } from 'react';
import { useDeferredAuth } from '@/components/providers/deferred-auth';
import { apiLoadSelf } from '@/lib/api/self';
import type { Participant } from '@/lib/identity';
import { getGuestSelfId } from '@/lib/local-identity';
import { onSelfColour } from '@/lib/self-presence';

export type SelfPresence =
  | { state: 'loading' }
  // No record yet (a first visit), or it could not be read: the card shows the neutral swatch.
  | { state: 'none'; id: string | null }
  | { state: 'ready'; self: Participant };

// What a read answered, for the id it was asked for.
type Loaded = { id: string; self: Participant | null };

export function useSelfPresence(): SelfPresence {
  const { authLoaded, accountId } = useDeferredAuth();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const id = authLoaded ? (accountId ?? getGuestSelfId()) : null;

  useEffect(() => {
    if (!id) return;
    let current = true;
    apiLoadSelf(id)
      .then((self) => {
        if (current) setLoaded({ id, self });
      })
      .catch((err: unknown) => {
        console.warn('[settings] reading your presence failed', err);
        if (current) setLoaded({ id, self: null });
      });
    return () => {
      current = false;
    };
  }, [id]);

  useEffect(
    () =>
      onSelfColour(({ id: changed, color }) =>
        setLoaded((l) => {
          if (l?.id !== changed) return l;
          if (color === null) return { id: l.id, self: null };
          // A first pick makes the record: its name is the account's, which the card reads from the session.
          const self = l.self ?? { id: changed, name: '', color, status: 'online' as const };
          return { id: l.id, self: { ...self, color } };
        }),
      ),
    [],
  );

  if (!authLoaded) return { state: 'loading' };
  if (!id) return { state: 'none', id: null };
  if (loaded?.id !== id) return { state: 'loading' };
  return loaded.self ? { state: 'ready', self: loaded.self } : { state: 'none', id };
}
