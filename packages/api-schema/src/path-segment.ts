// A path segment percent-decoded, or null when it carries a malformed escape (`%`, `%E0%A4%A`). Such a segment names
// nothing, so a reader answers it as it answers an unknown name: a 404 from the api, Home in the workspace frame,
// never decodeURIComponent's URIError.
export function decodePathSegment(segment: string): string | null {
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
}
