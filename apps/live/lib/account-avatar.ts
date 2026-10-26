// The profile picture's data (docs/specs/014-identity/profile-picture.md): which picture draws a signed-in person
// and the initial it falls back to. Pure, so the auth bridge, every avatar surface and the tests share one answer.

import { isProfilePictureUrl } from '@livedoc/api-schema';

/**
 * The profile picture URL, or null for the initials avatar: the account's picture (`image`, Google's picture for a
 * Google sign-in) when it is an https URL on the picture host, never anything else.
 */
export function resolveProfilePicture(user: { image: string | null }): string | null {
  return isProfilePictureUrl(user.image) ? user.image : null;
}

/** The letter on the initials avatar: the name's first letter, else the email's, else '?'. */
export function accountInitial(user: { name: string | null; email: string | null } | null): string {
  return (user?.name?.trim() || user?.email || '?').slice(0, 1).toUpperCase();
}
