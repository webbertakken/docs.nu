import { describe, expect, it } from 'vitest';
import { NEW_DOCUMENT_BLANKS, newDocumentBlankOf } from '@livedoc/templates';
import { pickerGroupCount } from './picker-group-count';
import { TEMPLATE_STARTS } from '@/components/start/start-template-items';

const blank = (id: string) => newDocumentBlankOf(id)!;

// docs/specs/013-workspace/new-document-menu.md "The menu"
describe('pickerGroupCount', () => {
  it('counts every template of a whole mode for Recommended', () => {
    const listed = new Set(TEMPLATE_STARTS.diagram.groups.flatMap((g) => g.kinds));
    listed.delete('blank');
    expect(pickerGroupCount(blank('diagram'))).toBe(listed.size);
  });

  it('counts a group less its blank', () => {
    const slides = TEMPLATE_STARTS.pages.groups.find((g) => g.id === 'slides')!;
    expect(pickerGroupCount(blank('slides'))).toBe(slides.kinds.length - 1);
  });

  it('counts Start Planning groups as a new document shows them', () => {
    expect(pickerGroupCount(blank('form'))).toBeGreaterThanOrEqual(blank('form').templates.length);
    expect(pickerGroupCount(blank('board'))).toBeGreaterThan(0);
    expect(pickerGroupCount(blank('sheet'))).toBeGreaterThan(0);
  });

  it('never offers fewer templates than the pane shows', () => {
    for (const b of NEW_DOCUMENT_BLANKS) {
      if (b.picker.mode === 'plan') continue;
      expect(pickerGroupCount(b), b.id).toBeGreaterThanOrEqual(b.templates.length);
    }
  });
});
