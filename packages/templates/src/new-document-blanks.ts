// The Explorer's New Document menu (docs/specs/013-workspace/new-document-menu.md "The blanks"): what a new document
// starts as, each a blank template, up to six of its templates and the picker group its All templates opens on. Pure
// data, in the menu's order; the number key of each is its place.
import type { EditorMode } from '@livedoc/document';
import type { TemplateKind } from './templates';

export const NEW_DOCUMENT_BLANK_IDS = [
  'diagram',
  'whiteboard',
  'page',
  'sheet',
  'board',
  'slides',
  'form',
  'workshop',
] as const;

export type NewDocumentBlankId = (typeof NEW_DOCUMENT_BLANK_IDS)[number];

/** How many templates the menu offers beside a blank. */
export const NEW_DOCUMENT_TEMPLATES_MAX = 6;

export type NewDocumentBlank = {
  id: NewDocumentBlankId;
  /** "Diagram": the row's name, and the face's "New Diagram". */
  name: string;
  /** The blank card's line. */
  line: string;
  /** What the blank makes. */
  blank: TemplateKind;
  /** The templates the pane offers, in order, at most NEW_DOCUMENT_TEMPLATES_MAX. */
  templates: readonly TemplateKind[];
  /** Where All templates opens: the mode's start, on this group. */
  picker: { mode: EditorMode; group: string };
};

export const NEW_DOCUMENT_BLANKS: readonly NewDocumentBlank[] = [
  {
    id: 'diagram',
    name: 'Diagram',
    line: 'An empty canvas, open at once.',
    blank: 'blank',
    // Start Diagramming's Recommended less its blank, then the Flowcharts group's next.
    templates: ['flowchart', 'mindmap', 'orgchart', 'gantt', 'system-architecture', 'swimlane'],
    picker: { mode: 'diagram', group: 'recommended' },
  },
  {
    id: 'whiteboard',
    name: 'Whiteboard',
    line: 'A clear board and a pen in hand.',
    blank: 'whiteboard',
    // Start Drawing's Recommended less its blank, then Prototypes.
    templates: [
      'sketchnote',
      'journey-doodle',
      'comic-strip',
      'idea-garden',
      'rich-picture',
      'paper-prototype',
    ],
    picker: { mode: 'draw', group: 'recommended' },
  },
  {
    id: 'page',
    name: 'Page',
    line: 'An empty page to write on.',
    blank: 'blank-article',
    // Start Making Pages' Articles less its blank.
    templates: ['article', 'working-backwards', 'resume', 'recipe-card'],
    picker: { mode: 'pages', group: 'articles' },
  },
  {
    id: 'sheet',
    name: 'Sheet',
    line: 'An empty grid, ready to type into.',
    blank: 'blank-spreadsheet',
    templates: [
      'budget-planner',
      'timesheet',
      'invoice',
      'expense-report',
      'contact-list',
      'sales-pipeline',
    ],
    picker: { mode: 'plan', group: 'spreadsheets' },
  },
  {
    id: 'board',
    name: 'Board',
    line: 'An empty board: set up its columns.',
    blank: 'blank-board',
    templates: [
      'kanban',
      'bug-triage',
      'weekly-planner',
      'content-calendar',
      'hiring-pipeline',
      'feedback-board',
    ],
    picker: { mode: 'plan', group: 'boards' },
  },
  {
    id: 'slides',
    name: 'Slides',
    line: 'An empty 16:9 slide.',
    blank: 'blank-slide-deck',
    // Start Making Pages' Slides less its blank.
    templates: [
      'slide-deck',
      'launch-keynote',
      'quarterly-review',
      'team-welcome',
      'workshop-kickoff',
    ],
    picker: { mode: 'pages', group: 'slides' },
  },
  {
    id: 'form',
    name: 'Form',
    line: 'A form with no questions yet.',
    blank: 'blank-form',
    templates: [
      'feedback-form',
      'bug-report-form',
      'feature-request-form',
      'rsvp-form',
      'job-application-form',
      'contact-form',
    ],
    picker: { mode: 'plan', group: 'forms' },
  },
  {
    id: 'workshop',
    name: 'Workshop',
    line: 'An empty board to run a session on.',
    blank: 'blank-session',
    // Start a Workshop's Recommended less its blank.
    templates: [
      'sailboat',
      'retrospective',
      'town-hall',
      'lean-coffee',
      'crazy-eights',
      'pub-quiz',
    ],
    picker: { mode: 'workshop', group: 'recommended' },
  },
];

/** The blank of an id; an unknown id reads as null. */
export function newDocumentBlankOf(id: string | null | undefined): NewDocumentBlank | null {
  return NEW_DOCUMENT_BLANKS.find((b) => b.id === id) ?? null;
}
