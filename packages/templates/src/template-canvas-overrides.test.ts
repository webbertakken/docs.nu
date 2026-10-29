import { describe, expect, it } from 'vitest';
import { templateCanvasOverrides } from './template-canvas-overrides';

// docs/specs/007-editor/templates-by-mode.md "A template's mode": a template's tab opens as the template was made to.
describe('templateCanvasOverrides', () => {
  it('opens a session template in Structured with the Workshop control on', () => {
    const o = templateCanvasOverrides('sailboat');
    expect(o.opensIn).toBeUndefined();
    expect(o.workshop).toBe(true);
    expect(templateCanvasOverrides('blank-session').workshop).toBe(true);
  });

  it('opens a Sketch or Pages template in its mode, the control off', () => {
    expect(templateCanvasOverrides('whiteboard')).toMatchObject({ opensIn: 'draw' });
    expect(templateCanvasOverrides('whiteboard').workshop).toBeUndefined();
    expect(templateCanvasOverrides('slide-deck').opensIn).toBe('pages');
  });

  it('opens a Structured template with neither', () => {
    const o = templateCanvasOverrides('flowchart');
    expect(o.opensIn).toBeUndefined();
    expect(o.workshop).toBeUndefined();
  });
});
