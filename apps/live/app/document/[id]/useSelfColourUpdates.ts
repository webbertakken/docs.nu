import { useEffect, type Dispatch, type RefObject, type SetStateAction } from 'react';
import type { Participant } from '@/lib/identity';
import { onSelfColour } from '@/lib/self-presence';

// A colour picked in Settings > Account (docs/specs/014-identity/auth-and-guest-access.md "Account settings") reaches
// the open editor at once: this participant's cursor, avatar and name tag take it. Settings has saved it already, so
// it is marked as persisted, and the editor's own save of the participant does not send it again.
export function useSelfColourUpdates(
  setSelf: Dispatch<SetStateAction<Participant>>,
  lastPersistedSelfRef: RefObject<{ name: string; color: string } | null>,
): void {
  useEffect(
    () =>
      onSelfColour(({ id, color }) => {
        setSelf((self) => {
          if (self.id !== id || self.color === color) return self;
          const persisted = lastPersistedSelfRef.current;
          if (persisted) lastPersistedSelfRef.current = { ...persisted, color };
          return { ...self, color };
        });
      }),
    [setSelf, lastPersistedSelfRef],
  );
}
