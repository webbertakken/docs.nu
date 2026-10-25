// Checks the exported /licences page after `next build`
// (docs/specs/002-project-scope/blueprints/third-party-licences.md "Testing"):
//   node packages/licences/scripts/verify.ts apps/marketing
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

import type { LicencesManifest } from '../src/contract.ts';
import { LicencesError } from '../src/errors.ts';
import { checkExport, textFingerprint } from '../src/verify-export.ts';
import { log, logFailure } from './log.ts';

function sizeOf(path: string): number | undefined {
  try {
    return statSync(path).size;
  } catch {
    return undefined;
  }
}

function listed(dir: string): string[] {
  try {
    return readdirSync(dir);
  } catch {
    return [];
  }
}

try {
  const appDir = resolve(process.argv[2] ?? '.');
  const manifest = JSON.parse(
    readFileSync(join(appDir, 'generated', 'licences.json'), 'utf8'),
  ) as LicencesManifest;
  const htmlBytes = sizeOf(join(appDir, 'out', 'licences.html'));
  const textsDir = join(appDir, 'out', 'licences', 'texts');
  const exportedTexts = listed(textsDir);
  const html =
    htmlBytes === undefined ? '' : readFileSync(join(appDir, 'out', 'licences.html'), 'utf8');
  const inlinedTexts = exportedTexts.flatMap((file) => {
    const fingerprint = textFingerprint(readFileSync(join(textsDir, file), 'utf8'));
    return fingerprint && html.includes(fingerprint) ? [file.replace(/\.txt$/, '')] : [];
  });
  const problems = checkExport({ manifest, htmlBytes, exportedTexts, inlinedTexts });
  if (problems.length > 0) {
    for (const reason of problems)
      log('licences.verify.failed', { reason: JSON.stringify(reason) });
    throw new LicencesError('LicencesVerifyFailed', problems.join('; '));
  }
  log('licences.verify.ok', { html_bytes: htmlBytes!, texts: exportedTexts.length });
} catch (error) {
  logFailure(error);
  process.exit(1);
}
