# Collaboration blueprint defaults

One row per default applied where a spec is silent or qualitative.

| #   | Blueprint     | Spec silence                                                 | Default applied                                                                         |
| --- | ------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| IB1 | idea-box-race | Which of several pending own cards comes out for a peer card | The newest one still in the box, so the earlier post (numbered first by the room) stays |
| IB2 | idea-box-race | How an id-less entry is written beside id-carrying ones      | `''`, so `ideaCardIds` stays aligned by position with `ideaCards`                       |
| IB3 | idea-box-race | Where the refused-post notice shows                          | The editor's error toast, as the Q&A board's refused note                               |
| IB4 | idea-box-race | How long an id may be                                        | 64 characters (`IDEA_CARD_ID_MAX`), the room's other id bound; a UUID is 36             |

| #   | Blueprint     | Spec silence                           | Default applied                                                                                                                                     |
| --- | ------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| WC1 | workshop-mode | Per tab or per person                  | Per tab, synced, one undo step: the mode is the tab's for the same reason, and a running vote or timer is the room's, so its kit must be everyone's |
| WC2 | workshop-mode | Structured's strip with the control on | The category bar, as Workshop mode's was, so a Workshop tab looks as it did and the Workshop tour's first step has its anchors                      |
| WC3 | workshop-mode | What Sketch gets, having no palette    | The Session strip only; the Collaborate tiles stay reachable from Structured or Pages                                                               |
| WC4 | workshop-mode | Who sees the control                   | An Editor on a general unlocked tab (the mode switch's gate); a Participant and a Viewer follow the tab's state without a control                   |
| WC5 | workshop-mode | Whether a new tab takes the control    | Yes, from the tab it was made from, as it takes the mode                                                                                            |
| WC6 | workshop-mode | The control's name and place           | "Workshop" with the flipchart mark, first among the document actions; pressed shows the brand fill Share uses                                       |

| #   | Blueprint         | Spec silence                                             | Default applied                                                                                    |
| --- | ----------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| FT1 | workshop-tour     | When to decide the Share step is out                     | When the tour starts, by whether the actions group's Share button is on screen                     |
| FT2 | workshop-tour     | The help card's hue                                      | `#ea580c`, a step from the Workshop control's `#c2410c`, as the Plan tour's is to Plan             |
| PM1 | presentation-mode | What counts as a step (counted from the slide asked for) | A move of exactly one slide; a jump (list, Home, End) is taken as given                            |
| PM2 | presentation-mode | What logs a refused fullscreen                           | `console.warn`, always shown ([Console logging](../../003-system-architecture/console-logging.md)) |
