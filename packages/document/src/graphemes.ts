// A text's characters as a reader sees them: grapheme clusters, so an emoji with its skin tone, a flag, a joined
// family emoji or a letter with a combining accent is one character and is never cut in half. Where a runtime has no
// Intl.Segmenter it falls back to code points, which still keep every emoji's surrogate pair together.

const segmenter =
  typeof Intl !== 'undefined' && 'Segmenter' in Intl
    ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    : null;

export function graphemes(text: string): string[] {
  return segmenter ? Array.from(segmenter.segment(text), (s) => s.segment) : Array.from(text);
}
