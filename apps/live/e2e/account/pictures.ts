import { PROFILE_PICTURE_HOST } from '@livedoc/api-schema';

// Profile pictures for the signed-in specs (docs/specs/014-identity/profile-picture.md). An account's picture is
// better-auth's `user.image`, drawn only from Google's picture host, so each spec gives its account a picture there
// and answers the host's requests itself: nothing reaches Google.

/** Every request for a picture on Google's host, for `page.route` / `context.route`. */
export const GOOGLE_PICTURES = `https://${PROFILE_PICTURE_HOST}/**`;

/** A picture URL on Google's host, shaped as Google stores one at sign-in (`…=s96-c`). */
export function googlePicture(label: string): string {
  return `https://${PROFILE_PICTURE_HOST}/a/e2e-${label}=s96-c`;
}

/** A stand-in picture: a flat disc of colour, served as SVG. */
export const STUB_PICTURE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><rect width="96" height="96" fill="#f59e0b"/><circle cx="48" cy="38" r="18" fill="#7c2d12"/><path d="M14 96c4-22 18-32 34-32s30 10 34 32z" fill="#7c2d12"/></svg>`;

/**
 * A target (red rim, green ring, blue centre) standing in for a square Google picture, at the size its `=s<px>-c`
 * option asks for. The rim is what a correctly framed disc shows at its edge; a disc that cropped the picture again
 * would show the green ring there instead.
 */
export const TARGET_RIM = { r: 239, g: 68, b: 68 };
export function googleTargetPicture(url: string): string {
  const px = Number(/=s(\d+)-c$/.exec(new URL(url).pathname)?.[1] ?? 96);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 100 100"><rect width="100" height="100" fill="rgb(${TARGET_RIM.r},${TARGET_RIM.g},${TARGET_RIM.b})"/><circle cx="50" cy="50" r="38" fill="#22c55e"/><circle cx="50" cy="50" r="24" fill="#3b82f6"/></svg>`;
}
