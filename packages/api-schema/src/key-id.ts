// The ids the api keys records by and builds paths, room names and scopes from (a document, a folder, a team):
// letters, digits, `-` and `_`, 1 to KEY_ID_MAX characters. Every id the app mints fits (UUIDs, `user_` account ids, short
// ids), so an id carrying a slash, a colon or a space is refused at the door rather than stored. KEY_ID_MAX is the room's
// own bound on a document id (apps/api room-session.ts), so an id the api takes is one the room can name.
export const KEY_ID_MAX = 64;

const KEY_ID = new RegExp(`^[A-Za-z0-9_-]{1,${KEY_ID_MAX}}$`);

export function isKeyId(value: unknown): value is string {
  return typeof value === 'string' && KEY_ID.test(value);
}
