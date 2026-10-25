// How a profile picture is requested and logged (docs/specs/014-identity/profile-picture.md): the sizes asked of
// Google's picture host, the URL for each, and the host a log may name. Pure; shared by PictureDisc and every app
// that draws a person (the editor, the Community app, the landing page).

/** The sizes asked for: 96px covers the largest disc (44px) at 2x, 192px at 3x and up. */
export const PICTURE_SIZES_PX = [96, 192] as const;

// Google's picture URLs carry their size as options after the last `=` of the path (`…/a/ACg8oc…=s96-c`).
const SIZE_OPTIONS = /=[a-z0-9-]*$/i;

/**
 * The picture at `px` square: Google's `s<px>-c` option (square, centred) in place of whatever options the URL had,
 * so a 96px picture stored at sign-in can still be drawn crisp at 192px.
 */
export function pictureSrc(url: string, px: number): string {
  const parsed = new URL(url);
  parsed.pathname = `${parsed.pathname.replace(SIZE_OPTIONS, '')}=s${px}-c`;
  return parsed.toString();
}

/** Width-described sources, so each disc's `sizes` picks 1x or 2x crisp. */
export function pictureSrcSet(url: string): string {
  return PICTURE_SIZES_PX.map((px) => `${pictureSrc(url, px)} ${px}w`).join(', ');
}

/** The host a picture URL points at, for logs that must not carry the URL itself. */
export function pictureHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return 'invalid';
  }
}
