import { describe, expect, it } from 'vitest';
import { parseMultipartRelated } from './multipart';

describe('parseMultipartRelated', () => {
  it('splits the metadata and media parts', () => {
    const body = [
      '--b1',
      'Content-Type: application/json; charset=UTF-8',
      '',
      '{"name":"x"}',
      '--b1',
      'Content-Type: application/vnd.livedoc+json',
      '',
      '{"kind":"livedoc.document"}',
      '--b1--',
      '',
    ].join('\r\n');
    expect(parseMultipartRelated('multipart/related; boundary=b1', body)).toEqual([
      { contentType: 'application/json; charset=UTF-8', body: '{"name":"x"}' },
      { contentType: 'application/vnd.livedoc+json', body: '{"kind":"livedoc.document"}' },
    ]);
  });

  it('refuses anything that is not multipart/related', () => {
    expect(() => parseMultipartRelated('application/json', '{}')).toThrow();
  });
});
