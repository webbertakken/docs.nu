import { describe, expect, it } from 'vitest';
import {
  NEW_DOCUMENT_BLANKS,
  NEW_DOCUMENT_BLANK_IDS,
  NEW_DOCUMENT_TEMPLATES_MAX,
  newDocumentBlankOf,
} from './new-document-blanks';
import { TEMPLATES } from './templates';
import { isBlankTemplate, templateEditorMode } from './template-modes';
import { popularKindsFor } from './popular';

const known = new Set(TEMPLATES.map((t) => t.kind));

describe('New Document blanks', () => {
  it('lists the eight blanks in the menu order', () => {
    expect(NEW_DOCUMENT_BLANKS.map((b) => b.id)).toEqual([...NEW_DOCUMENT_BLANK_IDS]);
    expect(NEW_DOCUMENT_BLANKS.map((b) => b.name)).toEqual([
      'Diagram',
      'Whiteboard',
      'Page',
      'Sheet',
      'Board',
      'Slides',
      'Form',
      'Workshop',
    ]);
  });

  it('makes a known blank template for each, in its picker mode', () => {
    for (const b of NEW_DOCUMENT_BLANKS) {
      expect(known.has(b.blank), b.id).toBe(true);
      expect(isBlankTemplate(b.blank), b.id).toBe(true);
      expect(templateEditorMode(b.blank), b.id).toBe(b.picker.mode);
    }
  });

  it('offers at most six known, distinct, non-blank templates of its mode', () => {
    for (const b of NEW_DOCUMENT_BLANKS) {
      expect(b.templates.length, b.id).toBeGreaterThan(0);
      expect(b.templates.length, b.id).toBeLessThanOrEqual(NEW_DOCUMENT_TEMPLATES_MAX);
      expect(new Set(b.templates).size, b.id).toBe(b.templates.length);
      for (const t of b.templates) {
        expect(known.has(t), `${b.id} ${t}`).toBe(true);
        expect(isBlankTemplate(t), `${b.id} ${t}`).toBe(false);
        expect(templateEditorMode(t), `${b.id} ${t}`).toBe(b.picker.mode);
      }
    }
  });

  it('leads a whole mode with its Recommended, less blanks', () => {
    for (const b of NEW_DOCUMENT_BLANKS.filter((x) => x.picker.group === 'recommended')) {
      const recommended = popularKindsFor(b.picker.mode).filter(
        (k) => !isBlankTemplate(k) && k !== 'timeline',
      );
      expect(b.templates.slice(0, recommended.length), b.id).toEqual(
        recommended.slice(0, NEW_DOCUMENT_TEMPLATES_MAX),
      );
    }
  });

  it('reads an unknown id as no blank', () => {
    expect(newDocumentBlankOf('sheet')?.blank).toBe('blank-spreadsheet');
    expect(newDocumentBlankOf('dashboard')).toBeNull();
    expect(newDocumentBlankOf(null)).toBeNull();
  });
});
