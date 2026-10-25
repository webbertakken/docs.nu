import { describe, expect, it } from 'vitest';

import type { LicencesManifest } from './contract.ts';
import {
  checkExport,
  LICENCES_HTML_BYTES_PER_WORK,
  licencesHtmlBudget,
  textFingerprint,
} from './verify-export.ts';

const manifest: LicencesManifest = {
  schemaVersion: 1,
  sections: [],
  texts: { aaaa: { lines: 1, bytes: 4 }, bbbb: { lines: 2, bytes: 8 } },
};
const BUDGET = licencesHtmlBudget(manifest);
const base = { exportedTexts: ['aaaa.txt', 'bbbb.txt'], inlinedTexts: [] };

describe('checkExport', () => {
  it('passes a page within budget with every text exported', () => {
    expect(checkExport({ manifest, htmlBytes: 1000, ...base })).toEqual([]);
  });

  it('names a missing page, missing texts and a page over budget', () => {
    expect(
      checkExport({
        manifest,
        htmlBytes: undefined,
        exportedTexts: ['aaaa.txt'],
        inlinedTexts: [],
      }),
    ).toEqual(['licences.html was not exported', 'text bbbb.txt was not exported']);
    expect(checkExport({ manifest, htmlBytes: BUDGET + 1, ...base })).toEqual([
      `licences.html is ${BUDGET + 1} bytes, over ${BUDGET}`,
    ]);
  });

  it('refuses a page listing no texts at all', () => {
    expect(
      checkExport({
        manifest: { ...manifest, texts: {} },
        htmlBytes: 10,
        exportedTexts: [],
        inlinedTexts: [],
      }),
    ).toEqual(['the manifest lists no texts']);
  });

  it('refuses a text inlined in the page', () => {
    expect(checkExport({ manifest, htmlBytes: 10, ...base, inlinedTexts: ['aaaa'] })).toEqual([
      'text aaaa.txt is inlined in licences.html',
    ]);
  });
});

describe('licencesHtmlBudget', () => {
  it('grows with the works listed, and allows one work on an empty page', () => {
    const work = {
      anchor: 'a',
      kind: 'package',
      name: 'a',
      version: '1',
      licence: 'MIT',
      apps: [],
      texts: [],
    };
    const two = {
      ...manifest,
      sections: [{ side: 'client', apps: [], works: [work, work] }],
    } as unknown as LicencesManifest;
    expect(licencesHtmlBudget(two)).toBe(2 * LICENCES_HTML_BYTES_PER_WORK);
    expect(licencesHtmlBudget(manifest)).toBe(LICENCES_HTML_BYTES_PER_WORK);
  });
});

describe('textFingerprint', () => {
  it('takes the first long line that HTML escaping leaves alone', () => {
    expect(
      textFingerprint(
        'MIT License\n\nCopyright (c) <2024> "x"\nPermission is hereby granted, free of charge, to any person',
      ),
    ).toBe('Permission is hereby granted, free of charge, to any person');
    expect(textFingerprint('short\nlines only')).toBeNull();
  });
});
