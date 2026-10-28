// Whether typed text names its URL scheme, or is a bare host that takes `https://`: the one rule every link field
// shares (a Form's Link answer, a Dashboard link, a note's or card's link). A colon followed by a port belongs to the
// host, so `example.com:8080/x` and `localhost:3000` are bare hosts, never the schemes `example.com:` and
// `localhost:`.
const SCHEME = /^[a-z][a-z0-9+.-]*:(?!\d+(?:[/?#]|$))/i;

export function hasUrlScheme(text: string): boolean {
  return SCHEME.test(text);
}

/** The text with `https://` in front when it names no scheme of its own. */
export function withUrlScheme(text: string): string {
  return hasUrlScheme(text) ? text : `https://${text}`;
}
