import { describe, expect, it } from 'vitest';
import { tabSearchText } from './search-text';

describe('tabSearchText', () => {
  it('reads the name, element texts, articles, page names and the form, in that order', () => {
    const tab = {
      id: 't',
      name: 'Sprint Retro',
      elements: [
        { id: 'a', type: 'shape', label: 'Went well', note: 'Café talk' },
        {
          id: 'b',
          type: 'shape',
          label: 'Actions',
          commentThread: { comments: [{ id: 'c', text: 'Ship it', authorId: 'p', createdAt: 1 }] },
        },
        { id: 'img', type: 'image', imageId: 'x' },
      ],
      articles: {
        f1: {
          blocks: [
            { id: 'b1', type: 'paragraph', runs: [{ text: 'Hello ' }, { text: 'world', b: true }] },
            { id: 'b2', type: 'code', text: 'const x = 1' },
            { id: 'b3', type: 'divider' },
          ],
        },
      },
      pages: [{ id: 'p1', orientation: 'portrait', name: 'Cover' }],
      form: {
        v: 1,
        heading: 'Feedback',
        description: 'Tell us',
        sections: [
          {
            id: 's',
            title: 'About you',
            questions: [
              {
                id: 'q',
                type: 'choice',
                prompt: 'Role?',
                help: 'Pick one',
                options: ['Dev', 'PM'],
              },
            ],
          },
        ],
      },
    };
    expect(tabSearchText(tab).split('\n')).toEqual([
      'Sprint Retro',
      'Went well',
      'Café talk',
      'Actions',
      'Ship it',
      'Hello world',
      'const x = 1',
      'Cover',
      'Feedback',
      'Tell us',
      'About you',
      'Role?',
      'Pick one',
      'Dev',
      'PM',
    ]);
  });

  it("adds a Sheet tab's cell inputs after the rest", () => {
    expect(tabSearchText({ name: 'Budget', elements: [] }, ['42', 'Rent'])).toBe(
      'Budget\n42\nRent',
    );
  });

  it('skips empty texts and survives a malformed body', () => {
    expect(tabSearchText({ name: '', elements: 'nope', articles: 3, form: null })).toBe('');
  });
});
