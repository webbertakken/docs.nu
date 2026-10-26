// Resolve a guest identity that is SIGNED wherever the host signs, so the sign-in migrate can later prove possession
// of the guest id rather than merely knowing it (docs/specs/014-identity/auth-and-guest-access.md "Signed guest ids":
// guest ids leak via DTOs / presence, so "knows the id" must not be enough to claim its data).
//
// States handled:
//   - Already signed ({id, sig} both stored): use it, no network.
//   - No id, or an unsigned one: ask the worker to mint a signed id. A host with sign-in signs it; adopt it. An
//     unsigned id from before is replaced, not moved: the host refuses it on every owner-scoped route, and it can
//     never move into an account.
//   - A host that signs nothing (guest-only): an unsigned id is all a guest needs; keep the one there is.
//   - Offline / the mint fails: keep any existing id, else mint a local unsigned one. The guest still works; a later
//     online load signs it.

import {
  ensureGuestSelfId,
  getGuestSelfId,
  getGuestSelfSig,
  reportParticipantCreated,
  setGuestIdentity,
} from './local-identity';
import { apiMintGuestId } from './api/self';

type GuestIdentity = { id: string; sig: string | null };

// Concurrent callers (the Explorer and its panels, a StrictMode double
// effect) share one resolution instead of each minting a different id, and
// each counting a new visitor, before the first one lands in storage.
let inflight: Promise<GuestIdentity> | null = null;

export function ensureSignedGuestIdentity(): Promise<GuestIdentity> {
  if (!inflight) {
    inflight = resolveSignedGuestIdentity().finally(() => {
      inflight = null;
    });
  }
  return inflight;
}

async function resolveSignedGuestIdentity(): Promise<GuestIdentity> {
  const existingId = getGuestSelfId();
  const existingSig = getGuestSelfSig();
  if (existingId && existingSig) return { id: existingId, sig: existingSig };
  // No id at all → this browser has never had a participant: the
  // daily new-visitors signal (docs/specs/017-telemetry/telemetry.md). Emitted per adopted branch
  // below rather than up here so the offline fallback doesn't double
  // count (ensureGuestSelfId reports its own mint), and through the
  // once-per-load reportParticipantCreated so a local mint that raced
  // this one's network round-trip doesn't count the browser twice.
  const isNewVisitor = !existingId;

  const minted = await apiMintGuestId();
  if (!minted) {
    // Offline / error: keep any existing id, else mint a local UUID.
    return { id: existingId ?? ensureGuestSelfId(), sig: null };
  }
  if (!minted.ownerSig) {
    // Worker signing disabled: keep an existing id (don't churn it), else
    // adopt the freshly generated (unsigned) one.
    const id = existingId ?? minted.ownerId;
    setGuestIdentity(id, null);
    if (isNewVisitor) reportParticipantCreated();
    return { id, sig: null };
  }
  // Worker returned a SIGNED id: this host signs guests, so an unsigned id is no use here any more.
  if (existingId) console.warn('[guest-identity] unsigned_id_replaced');
  setGuestIdentity(minted.ownerId, minted.ownerSig);
  if (isNewVisitor) reportParticipantCreated();
  return { id: minted.ownerId, sig: minted.ownerSig };
}
