# New Document menu

The Explorer's **New Document** is a split button and a menu. Its face makes a blank document at once; its menu
offers every blank LiveDoc makes, each with six of its templates and the way to all of them. A blank opens in the
editor straight away, without a page load and without waiting on the server, and opens empty, its template start
closed: whoever asked for a blank gets a blank.

## Why

- Starting a document took three steps: New Document loaded `/new`, the wizard asked for a mode, and the document
  opened on that mode's template start, which still had to be closed before work could begin. Someone who knew what
  they wanted paid for every step.
- A document that is still empty needs nothing from the server to open. Waiting for one made a new document the
  slowest thing to open in LiveDoc.

## Domain language

| Term                  | Means                                                                             | Never called                      |
| --------------------- | --------------------------------------------------------------------------------- | --------------------------------- |
| **New Document menu** | The split button and its menu in the Explorer's pane header                       | create menu, new menu, launcher   |
| **blank**             | One entry of the menu: what a new document starts as (Diagram, Sheet, ...), empty | kind, type, document type, mode   |
| **last blank**        | The blank this browser made last; the face makes it                               | default blank, favourite          |
| **picker group**      | The group of a template start that a blank's **All templates** opens on           | category (the catalogue's), shelf |

- A blank is never called a kind: a kind is what a tab is, and Diagram and Whiteboard are modes of one kind
  ([Domain language](../003-system-architecture/domain-language.md#mode-kind-and-template)). The blanks name what
  people make, whatever mode or kind makes it.

## The blanks

In this order, each with its glyph and number key:

| #   | Blank      | Makes (its blank template)              | Its templates                             | All templates opens              |
| --- | ---------- | --------------------------------------- | ----------------------------------------- | -------------------------------- |
| 1   | Diagram    | Blank Diagram (`blank`)                 | Start Diagramming's Recommended           | Start Diagramming, Recommended   |
| 2   | Whiteboard | Blank Whiteboard (`whiteboard`)         | Start Drawing's Recommended               | Start Drawing, Recommended       |
| 3   | Page       | Blank Article (`blank-article`)         | Start Making Pages' Articles              | Start Making Pages, **Articles** |
| 4   | Sheet      | Blank Spreadsheet (`blank-spreadsheet`) | Sheet templates (Budget, Timesheet, ...)  | Start Planning, **Spreadsheets** |
| 5   | Board      | Blank Board (`blank-board`)             | Board templates (Kanban, Bug Triage, ...) | Start Planning, **Boards**       |
| 6   | Slides     | Blank Slide Deck (`blank-slide-deck`)   | Start Making Pages' Slides                | Start Making Pages, **Slides**   |
| 7   | Form       | Blank Form (`blank-form`)               | The form templates                        | Start Planning, **Forms**        |
| 8   | Workshop   | Blank Session (`blank-session`)         | Start a Workshop's Recommended            | Start a Workshop, Recommended    |

- **Page** is prose. It makes an Article ([Article pages](../007-editor/article-pages.md)) until the
  [markdown tab](../031-markdown/markdown-tab.md) ships; then it makes a page, a document of one markdown tab.
- **Blank Board** is a new blank: one Board tab holding a Blank board, which starts on Setup Board
  ([Plan board](../026-plan/plan-board.md)). Every other blank is an existing template.
- **Dashboard is not a blank.** A dashboard shows a document's own boards and sheets, and a new document has none;
  it is made from Start Planning once there is work to show.
- **Event Storming** is not offered: it is made from its templates and imports, never from nothing.

## The button

- The pane header's create action, wherever a section offers New Document
  ([Folders](folders.md), `paneHeaderActions`). It replaces the Create dropdown and the lone New Document button.
- **A split button**, brand-filled, as tall as Help:
  - **The face** reads **New <last blank>** ("New Diagram") with the plus glyph, and makes that blank at once.
    The last blank is kept per browser; before any, it is Diagram. On a phone the face shows the plus and the
    blank's glyph only, its name in `aria-label`.
  - **The caret**, its own button behind a hairline, opens the menu. So does the Down arrow on the face.

## The menu

A popover under the button, its right edge on the button's. Two panes side by side:

- **The list**, on the right, straight under the button where the pointer already is: the eight blanks, each its
  glyph in its own tint, its name and its number key in a key cap. The selected row is filled. Where the section
  offers New Folder ([Folders](folders.md)), a hairline and **New Folder** (or **New Subfolder**) end the list.
- **The pane**, to the left of the list, for the selected blank:
  - **The blank card**: the blank's preview, **Blank <name>** ("Blank Diagram"), one line ("An empty canvas, open at
    once."), and an **Enter** key cap. Ringed in brand blue: it is what Enter makes.
  - **From a template**: up to **six** of the blank's templates, three to a row, each its preview and name. Fewer
    when the blank has fewer. No group chips.
  - **All <N> <name> templates** at the foot, N the number the picker group holds.
- **The menu opens on the last blank.** Hovering a row selects it; the arrow keys do too.
- **Hovering never steals the selection on the way to the pane.** While the pointer moves towards the pane, the rows
  it crosses do not select (menu aim): a row selects once the pointer rests on it, or moves away from the pane.
- **Both panes keep their size** whatever is selected: the pane is the height of the list, so nothing jumps.

### What each choice does

| Choice                                                    | Makes                                                                       | Opens on                               |
| --------------------------------------------------------- | --------------------------------------------------------------------------- | -------------------------------------- |
| The face, a list row, the blank card, Enter, a number key | The blank                                                                   | The canvas, its start closed           |
| A template card                                           | A document from that template                                               | The template                           |
| All N templates                                           | The blank's mode blank (Blank Diagram, Blank Plan, Blank Illustration, ...) | That mode's start, on the picker group |
| New Folder                                                | A folder, as before                                                         | The folder, its name being edited      |

- Every document choice remembers its blank as the last blank and closes the menu.
- **A blank opens with its start closed** (`closeStartForBlank`): no template picker over it. The palette tray's
  **Show Templates** still brings the start back while the tab is empty
  ([Template starts](../007-editor/start-diagramming.md#bringing-it-back)).
- **All templates** hands the picker group to the new document's start, read once, as a `/new?q=` search is
  ([Template starts](../007-editor/start-diagramming.md#group-handed-over)).

## Where it goes

As every new document does ([New document route](../007-editor/new-document-route.md#one-step-wizard)):

- **Stored** where the default for who is creating says: This Browser for a guest, LiveDoc for everyone else
  ([Save locations](../006-document/save-locations.md#the-default-depends-on-who-is-creating)).
- **Filed** in the folder or team the Explorer shows, an explicit placement; anywhere else (Home, Recent, a view) it
  carries none, and the server files it in the person's [default folder](default-folders.md) for its intent.
- **Named** after its template ("Untitled Diagram").

## Opening at once

A blank is on screen, editable, **within 200 ms of the click**, and a template within 500 ms.

- **No page load.** The Explorer opens the editor in its own place, as `/new` hands off
  ([In-place handoff](../007-editor/new-document-route.md#in-place-handoff-to-the-editor)), the address bar moving
  to `/document/<id>` with a new history entry, so Back returns to the Explorer where it was.
- **No server wait.** The document is made in the browser and the editor opens it from memory. The server's create
  runs behind it; the room connects, and what was done meanwhile is saved, once the create has landed. A document in
  This Browser is written to the browser first, as it is today ([Offline mode](../006-document/offline-mode.md#instant-open)).
- **Nothing to fetch first.** The editor's code is fetched while the Explorer is idle, and again when the pointer
  reaches the button.
- **A create that fails loses nothing.** The editor stays open with what was done, says the document is not saved
  yet, and offers **Try again**, which re-runs the same create under the same id
  ([New document route](../007-editor/new-document-route.md#a-failed-load-is-not-a-missing-document)). A refused
  placement says why and offers **Save to My Documents**.

## Keyboard and screen readers

- The face and the caret are buttons; the caret has `aria-haspopup="menu"` and `aria-expanded`.
- The list is a `menu` of `menuitem`s named "<name>, blank" with `aria-keyshortcuts` 1 to 8. The pane's template
  cards are `menuitem`s in a labelled `group` ("Diagram templates"), as are the blank card and All templates.
- **Up and Down** move along the list, wrapping; **Home** and **End** reach its ends. **Enter** makes the selected
  blank. **1 to 8** make that blank from anywhere in the menu. **Left** moves into the pane (the blank card, then
  the templates, then All templates, as a grid), **Right** from the pane's right column back to the list. **Escape**
  closes the menu and puts focus back on the caret; **Tab** moves through the menu and leaves it closed.
- Focus is visible on every row and card (the brand ring). Reduced motion: the menu appears without its fade.

## On a phone

Below `sm` the menu is a sheet from the bottom edge, the list only: each row makes its blank, and a **Templates**
button at its end swaps the sheet to that blank's pane, with **Back**. New Folder ends the list.

## The `/new` wizard

The New Document menu never goes through `/new`. The wizard stays for the links that ask for it (the public sites, `/new?mode=`,
a blank's or template's link), unchanged ([New document route](../007-editor/new-document-route.md)).

## Telemetry

- `UI · Opened · NewDocumentMenu` when the menu opens.
- `UI · Used · NewDocumentBlank`, `NewDocumentTemplate` or `NewDocumentAllTemplates` for each choice; the usual
  `Document · Created` and `Template · Used` follow.
- `Timing` of the open, from click to the editor painted ([Timing telemetry](../017-telemetry/timing-telemetry.md)),
  as `NewDocumentOpen`.

## Logs

`[new-document] choice=<blank|template|all-templates> blank=<id> template=<kind>`, then
`[new-document] opened ms=<n>`, `[new-document] create-landed ms=<n>` or
`[new-document] create-failed action=<retry|choose>`.
