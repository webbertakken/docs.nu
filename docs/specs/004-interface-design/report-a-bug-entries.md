# Report a Bug entries

Where the way to report a bug sits on each screen, and how it looks there. What the form does is
[Bug reports](../016-platform/bug-reports.md).

## The rule

- **One standing entry per screen, in the screen's own style.** The plumbing is shared (one form, one opener,
  `useOpenBugReport()`); the controls are not, so a bottom bar's icon, an error card's button and a footer link each
  look like their neighbours.
- **The name is always "Report a Bug"**, title case like every LiveDoc control label; its icon is Lucide's `bug`, at
  the bar's own icon size and weight ([Iconography](./iconography.md)).
- **Error screens name the way to report.** A crash or a failed load is when a report is worth most, so the error
  card carries "Report a Bug" as a secondary button beside its retry action, never instead of it.

## Where each entry sits

| Screen                                      | Place                                                                                 | Style                                            |
| ------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Editor bottom bar, Explorer bottom bar      | In the shared right-hand cluster (`ChromeControls`), after Search and before Settings | Chrome icon button, Hover card "Report a Bug"    |
| Account menu                                | Above "Sign out"                                                                      | Menu item                                        |
| Connection and load error cards             | Under the retry button                                                                | Secondary button, small                          |
| An area's crash panel (`AreaErrorBoundary`) | After "Try Again"                                                                     | Secondary button, extra small                    |
| Root error page                             | Under "Reload"                                                                        | Text link to `/report-a-bug`                     |
| Not-found card                              | Under "New Document"                                                                  | Secondary button                                 |
| Help centre contact page                    | The "Report a Bug" card, in place of the GitHub issues card                           | Secondary call-to-action link to `/report-a-bug` |
| Shared site footer                          | The Contact column, after Contact                                                     | Footer link to `/report-a-bug`                   |

The bottom-bar entry stays on a phone (the bar is tight, but reporting is mid-task, unlike GitHub, which leaves the
app). Its hover card reads "Report a Bug" / "Tell us what went wrong. Opens a short form.".

## The form's look

The form is a standard dialog (`Dialog`, `lg`), a sheet on a phone, with the dialog header, the fields in one column,
and the Send button pinned in the footer so it stays above a phone's keyboard. The screenshot preview is a bordered
thumbnail at most 12rem tall, its picture never stretched. What's Attached is a closed `<details>` disclosure in muted
text. Dark mode follows the app's palette like every dialog.
