import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { checkMotionBudget, formatViolations } from '@livedoc/tailwind-config/motion-budget';

// Shared chrome (docs/specs/004-interface-design/motion.md): every app renders these
// components, so they are held to the motion budget here, at the source.
describe('shared UI motion', () => {
  it('keeps every chrome duration within the budget', () => {
    const root = fileURLToPath(new URL('.', import.meta.url));
    // The logo's assembly is content motion with its own pace (docs/specs/004-interface-design/motion.md).
    expect(
      formatViolations(checkMotionBudget({ root, canvasStylesheets: ['brand-motion.css'] })),
    ).toBe('');
  });
});
