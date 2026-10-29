// The editor route was /diagram/<id> before the container became a document
// (docs/specs/016-platform/router-app.md, "Legacy editor route"). Every old share link,
// embed and bookmark is sent on for good, query string included.
const LEGACY_EDITOR_PATH = '/diagram';
const EDITOR_PATH = '/document';

export function legacyEditorRedirect(url: URL): Response | null {
  const { pathname } = url;
  if (pathname !== LEGACY_EDITOR_PATH && !pathname.startsWith(`${LEGACY_EDITOR_PATH}/`))
    return null;
  const next = new URL(url.toString());
  next.pathname = EDITOR_PATH + pathname.slice(LEGACY_EDITOR_PATH.length);
  return Response.redirect(next.toString(), 308);
}

// Renamed help articles: the ones about the container moved when it became a document,
// Whiteboards became Draw mode and then Sketch mode, the Highlighter went from a selection mode to a Draw tile, and
// the Activity Panel category went when the panel was removed (Undo and Redo moved to Canvas;
// its other articles land on Undo), Infographics became Illustrate mode and then Pages mode,
// Facilitate mode became Workshop mode and then the Workshop control, Plan mode became Plan tabs, and the
// Welcome Tour became the Diagram Tour. The old
// addresses are links people have already shared (docs/specs/018-help/help-app.md, "Renamed articles").
const LEGACY_HELP_ARTICLES: Readonly<Record<string, string>> = {
  'tabs/add-to-diagram': 'tabs/add-to-document',
  'troubleshooting/diagram-not-loading': 'troubleshooting/document-not-loading',
  'collaboration/teams/team-shared-diagrams': 'collaboration/teams/team-shared-documents',
  'search-panel/the-search-panel/search-diagrams': 'search-panel/the-search-panel/search-documents',
  'getting-started/sharing-your-diagram': 'getting-started/sharing-your-document',
  'developers/working-with-diagrams': 'developers/working-with-documents',
  'canvas/whiteboards': 'canvas/sketch-mode',
  'canvas/draw-mode': 'canvas/sketch-mode',
  'canvas/draw-mode/draw-tour': 'canvas/sketch-mode/sketch-tour',
  'canvas/infographics': 'canvas/pages-mode',
  'canvas/infographics/infographic-layouts': 'canvas/pages-mode/infographic-layouts',
  'canvas/infographics/exporting-infographics': 'canvas/pages-mode/exporting-pages',
  'canvas/illustrate': 'canvas/pages-mode',
  'canvas/illustrate/articles': 'canvas/pages-mode/articles',
  'canvas/illustrate/exporting-pages': 'canvas/pages-mode/exporting-pages',
  'canvas/illustrate/illustrate-tour': 'canvas/pages-mode/pages-tour',
  'canvas/illustrate/infographic-layouts': 'canvas/pages-mode/infographic-layouts',
  'canvas/illustrate/logo-pages': 'canvas/pages-mode/logo-pages',
  'canvas/illustrate/slide-pages': 'canvas/pages-mode/slide-pages',
  'canvas/illustrate/tab-windows': 'canvas/pages-mode/tab-windows',
  'canvas/facilitate-mode': 'canvas/workshop',
  'canvas/facilitate-mode/facilitate-tour': 'canvas/workshop/workshop-tour',
  'canvas/workshop-mode': 'canvas/workshop',
  'canvas/workshop-mode/workshop-tour': 'canvas/workshop/workshop-tour',
  'canvas/plan-mode': 'canvas/plan-tabs',
  'canvas/plan-mode/boards': 'canvas/plan-tabs/boards',
  'canvas/plan-mode/card-types': 'canvas/plan-tabs/card-types',
  'canvas/plan-mode/cards': 'canvas/plan-tabs/cards',
  'canvas/plan-mode/dashboards': 'canvas/plan-tabs/dashboards',
  'canvas/plan-mode/forms': 'canvas/plan-tabs/forms',
  'canvas/plan-mode/items': 'canvas/plan-tabs/items',
  'canvas/plan-mode/plan-tour': 'canvas/plan-tabs/plan-tour',
  'canvas/plan-mode/sheet-functions': 'canvas/plan-tabs/sheet-functions',
  'canvas/plan-mode/sheets': 'canvas/plan-tabs/sheets',
  'canvas/plan-mode/visualisations': 'canvas/plan-tabs/visualisations',
  'selection-modes/highlighter': 'palette/tools/highlighter',
  'activity-panel': 'canvas/undo',
  'activity-panel/what-it-is': 'canvas/undo',
  'activity-panel/how-it-works': 'canvas/undo',
  'activity-panel/undo': 'canvas/undo',
  'activity-panel/redo': 'canvas/redo',
  'activity-panel/reverting-changes': 'canvas/undo',
  'getting-started/welcome-tour': 'getting-started/diagram-tour',
};

export function legacyHelpRedirect(url: URL): Response | null {
  const match = /^\/help\/(.+?)(\/?)$/.exec(url.pathname);
  const next = match ? LEGACY_HELP_ARTICLES[match[1]!] : undefined;
  if (!match || !next) return null;
  const target = new URL(url.toString());
  target.pathname = `/help/${next}${match[2]}`;
  return Response.redirect(target.toString(), 308);
}
