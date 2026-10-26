import { describe, expect, it } from 'vitest';
import {
  parseWorkbenchMessage,
  WORKBENCH_MESSAGE_TYPES,
  type WorkbenchMessageDirection,
} from './workbench-messages';

const TICKET = 'A'.repeat(21) + '_';

describe('WORKBENCH_MESSAGE_TYPES', () => {
  it('holds the twelve types of the spec', () => {
    expect(WORKBENCH_MESSAGE_TYPES).toEqual([
      'livedoc:hello',
      'livedoc:hello-ack',
      'livedoc:ready',
      'livedoc:tab',
      'livedoc:selection',
      'livedoc:renew',
      'livedoc:ticket',
      'livedoc:reveal',
      'livedoc:theme',
      'livedoc:ended',
      'livedoc:place',
      'livedoc:open',
    ]);
  });
});

describe('parseWorkbenchMessage', () => {
  const valid: [WorkbenchMessageDirection, Record<string, unknown>][] = [
    ['to-workbench', { type: 'livedoc:hello', v: 1 }],
    [
      'to-workbench',
      {
        type: 'livedoc:ready',
        v: 1,
        documentId: 'doc-1',
        documentName: 'Home screen',
        tabId: 't1',
        tabName: 'Wireframe',
        role: 'edit',
      },
    ],
    ['to-workbench', { type: 'livedoc:tab', v: 1, tabId: 't1', tabName: 'Wireframe' }],
    [
      'to-workbench',
      {
        type: 'livedoc:selection',
        v: 1,
        documentId: 'doc-1',
        documentName: 'Home screen',
        tabId: 't1',
        rev: 41,
        count: 0,
        reference: '[LiveDoc] "Home screen"',
      },
    ],
    ['to-workbench', { type: 'livedoc:renew', v: 1 }],
    ['to-workbench', { type: 'livedoc:ended', v: 1, reason: 'revoked' }],
    ['to-page', { type: 'livedoc:ticket', v: 1, ticket: TICKET }],
    ['to-page', { type: 'livedoc:reveal', v: 1, refs: ['146b', 'e4a8'] }],
    ['to-page', { type: 'livedoc:theme', v: 1, colourScheme: 'dark' }],
  ];

  it.each(valid)('accepts a valid message travelling %s: %o', (direction, data) => {
    expect(parseWorkbenchMessage(data, direction)).toEqual(data);
  });

  it('accepts a hello-ack and trims its name', () => {
    expect(
      parseWorkbenchMessage({ type: 'livedoc:hello-ack', v: 1, name: '  Acme Editor ' }, 'to-page'),
    ).toEqual({ type: 'livedoc:hello-ack', v: 1, name: 'Acme Editor' });
  });

  it.each([
    ['an unknown type', { type: 'livedoc:dance', v: 1 }, 'livedoc:dance'],
    ['another version', { type: 'livedoc:theme', v: 2, colourScheme: 'dark' }, 'livedoc:theme'],
    ['a page message sent to the page', { type: 'livedoc:renew', v: 1 }, 'livedoc:renew'],
    ['a message with no type', { v: 1 }, 'undefined'],
    ['a string', 'hello', 'undefined'],
    ['null', null, 'undefined'],
  ])('ignores %s', (_label, data, type) => {
    expect(parseWorkbenchMessage(data, 'to-page')).toEqual({ ignored: type });
  });

  it('bounds the logged type of an ignored message', () => {
    const parsed = parseWorkbenchMessage({ type: 'x'.repeat(200), v: 1 }, 'to-page');
    expect(parsed).toEqual({ ignored: 'x'.repeat(64) });
  });

  it.each([
    ['a hello-ack with no name', { type: 'livedoc:hello-ack', v: 1 }],
    ['a hello-ack with a blank name', { type: 'livedoc:hello-ack', v: 1, name: '   ' }],
    [
      'a hello-ack with an overlong name',
      { type: 'livedoc:hello-ack', v: 1, name: 'x'.repeat(41) },
    ],
    ['a ticket of the wrong shape', { type: 'livedoc:ticket', v: 1, ticket: 'short' }],
    ['a ticket that is not a string', { type: 'livedoc:ticket', v: 1, ticket: 42 }],
    ['a reveal with no refs', { type: 'livedoc:reveal', v: 1, refs: [] }],
    ['a reveal with too many refs', { type: 'livedoc:reveal', v: 1, refs: Array(21).fill('a') }],
    ['a reveal with an empty ref', { type: 'livedoc:reveal', v: 1, refs: [''] }],
    ['a reveal with an overlong ref', { type: 'livedoc:reveal', v: 1, refs: ['x'.repeat(65)] }],
    ['a reveal whose refs are not a list', { type: 'livedoc:reveal', v: 1, refs: 'a' }],
    ['a reveal with a ref that is not a string', { type: 'livedoc:reveal', v: 1, refs: [1] }],
    ['a theme of another scheme', { type: 'livedoc:theme', v: 1, colourScheme: 'sepia' }],
  ])('names %s invalid', (_label, data) => {
    expect(parseWorkbenchMessage(data, 'to-page')).toEqual({ invalid: data.type });
  });

  it.each([
    [
      'a ready with an unknown role',
      {
        type: 'livedoc:ready',
        v: 1,
        documentId: 'd',
        documentName: 'n',
        tabId: 't',
        tabName: 'n',
        role: 'admin',
      },
    ],
    [
      'a ready missing its tab',
      { type: 'livedoc:ready', v: 1, documentId: 'd', documentName: 'n', role: 'view' },
    ],
    ['a tab missing its name', { type: 'livedoc:tab', v: 1, tabId: 't' }],
    [
      'a selection with a fractional rev',
      {
        type: 'livedoc:selection',
        v: 1,
        documentId: 'd',
        documentName: 'n',
        tabId: 't',
        rev: 1.5,
        count: 0,
        reference: 'r',
      },
    ],
    [
      'a selection with a negative count',
      {
        type: 'livedoc:selection',
        v: 1,
        documentId: 'd',
        documentName: 'n',
        tabId: 't',
        rev: 1,
        count: -1,
        reference: 'r',
      },
    ],
    [
      'a selection with no reference',
      {
        type: 'livedoc:selection',
        v: 1,
        documentId: 'd',
        documentName: 'n',
        tabId: 't',
        rev: 1,
        count: 0,
      },
    ],
    ['an ended with another reason', { type: 'livedoc:ended', v: 1, reason: 'bored' }],
  ])('names %s invalid at the workbench', (_label, data) => {
    expect(parseWorkbenchMessage(data, 'to-workbench')).toEqual({ invalid: data.type });
  });
});

describe('parseWorkbenchMessage, workspace scope', () => {
  const place = {
    type: 'livedoc:place',
    v: 1,
    view: 'folder',
    folderId: 'f1',
    folderName: 'Minigames',
    documentCount: 0,
    documentId: null,
    documentName: null,
    tabId: null,
    tabName: null,
    role: 'edit',
  };

  it.each([
    ['to-workbench', { type: 'livedoc:ready', v: 1, scope: 'workspace', role: 'view' }],
    ['to-workbench', place],
    [
      'to-workbench',
      {
        ...place,
        view: 'document',
        documentCount: null,
        documentId: 'doc-1',
        documentName: 'Home screen',
        tabId: 't1',
        tabName: 'Wireframe',
      },
    ],
    ['to-page', { type: 'livedoc:open', v: 1, to: { view: 'home' } }],
    ['to-page', { type: 'livedoc:open', v: 1, to: { folderId: 'f1' } }],
    ['to-page', { type: 'livedoc:open', v: 1, to: { documentId: 'doc-1' } }],
    ['to-page', { type: 'livedoc:open', v: 1, to: { documentId: 'doc-1', tabId: 't1' } }],
  ] as const)('accepts a valid message travelling %s: %o', (direction, data) => {
    expect(parseWorkbenchMessage(data, direction)).toEqual(data);
  });

  it.each([
    [
      'a workspace ready with an unknown role',
      { type: 'livedoc:ready', v: 1, scope: 'workspace', role: 'admin' },
    ],
    ['a ready of another scope', { type: 'livedoc:ready', v: 1, scope: 'galaxy', role: 'edit' }],
    ['a place with no view', { ...place, view: '' }],
    ['a place with a fractional count', { ...place, documentCount: 1.5 }],
    ['a place with a numeric folder', { ...place, folderId: 7 }],
    ['a place missing its role', { ...place, role: undefined }],
  ])('names %s invalid at the workbench', (_label, data) => {
    expect(parseWorkbenchMessage(data, 'to-workbench')).toEqual({ invalid: data.type });
  });

  it.each([
    ['an open with no target', { type: 'livedoc:open', v: 1 }],
    ['an open to another view', { type: 'livedoc:open', v: 1, to: { view: 'recent' } }],
    ['an open to an empty folder id', { type: 'livedoc:open', v: 1, to: { folderId: '' } }],
    [
      'an open to an overlong document id',
      { type: 'livedoc:open', v: 1, to: { documentId: 'x'.repeat(65) } },
    ],
    [
      'an open to a tab that is not a string',
      { type: 'livedoc:open', v: 1, to: { documentId: 'd', tabId: 4 } },
    ],
  ])('names %s invalid at the page', (_label, data) => {
    expect(parseWorkbenchMessage(data, 'to-page')).toEqual({ invalid: data.type });
  });
});
