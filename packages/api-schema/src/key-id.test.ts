import { describe, expect, it } from 'vitest';
import { KEY_ID_MAX, isKeyId } from './key-id';

describe('isKeyId', () => {
  it('takes the ids the app mints: UUIDs, prefixed ids, short ids', () => {
    for (const id of [
      '00000000-0000-4000-8000-000000000001',
      'user_abc',
      'f1',
      'x'.repeat(KEY_ID_MAX),
    ])
      expect(isKeyId(id), id).toBe(true);
  });

  it('refuses slashes, colons, spaces, the empty id, an id past KEY_ID_MAX and a non-string', () => {
    for (const id of ['a/b', 'a:b', 'a b', '', 'x'.repeat(KEY_ID_MAX + 1), 7, null, undefined])
      expect(isKeyId(id), String(id)).toBe(false);
  });
});
