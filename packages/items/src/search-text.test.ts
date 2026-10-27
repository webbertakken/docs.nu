import { describe, expect, it } from 'vitest';
import { itemsSearchText } from './search-text';

const item = (fields: Record<string, unknown>) => ({ fields }) as never;

describe('itemsSearchText', () => {
  it("reads each live card's title, description and comments", () => {
    expect(
      itemsSearchText([
        item({
          title: 'Fix login',
          description: 'Users see a blank page',
          descriptionRich: [{ text: 'On ' }, { text: 'Safari', b: true }],
          comments: { comments: [{ id: 'c', text: 'Repro on iOS' }] },
        }),
        item({ title: 'Old', status: 'trash' }),
        item({ title: 'Shelved', archived: true }),
        item({ title: '' }),
      ]),
    ).toBe('Fix login\nUsers see a blank page\nOn Safari\nRepro on iOS');
  });
});

describe('itemsSearchText on odd fields', () => {
  it('skips rich runs and comments that are not records', () => {
    expect(
      itemsSearchText([
        item({
          title: 'T',
          descriptionRich: ['x', { text: 'ok' }, { b: true }],
          comments: { comments: [3, { text: 'c' }] },
        }),
      ]),
    ).toBe('T\nok\nc');
  });
});
