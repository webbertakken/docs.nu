# Platform blueprint defaults

One row per default applied where a spec is silent or qualitative.

| #   | Blueprint          | Spec silence                            | Default applied                                                                                            |
| --- | ------------------ | --------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| D1  | new-version-prompt | How often to check for a saved state    | Every 200 ms while waiting, locally (no request)                                                           |
| D2  | new-version-prompt | Where the prompt sits                   | Bottom centre, 80 px up like the photo import bars, on the chrome layer                                    |
| D3  | new-version-prompt | What "Not now" remembers                | The dismissed server number, for this page only                                                            |
| D4  | stale-builds       | Which id names a build                  | The deploy's commit, from the one build job both deploys use                                               |
| D5  | stale-builds       | How long the loop guard remembers       | One minute per destination, in `sessionStorage`                                                            |
| D6  | stale-builds       | Which URL a recovery loads              | The navigation intent within 10 s, else the current URL                                                    |
| D7  | nextjs             | How the shared config is shaped         | One function, `livedocNextConfig`, each app spreading it                                                   |
| D8  | nextjs             | Turbopack-only flags under webpack      | Left off together with the compiler, so the webpack escape hatch still builds                              |
| D9  | trusted-types      | Where the third-party origins come from | Named in code (`GOOGLE_SCRIPT_ORIGINS`), for the editor build with a Google client id only; none elsewhere |
| D10 | trusted-types      | What a refused script URL does          | Returns null (the browser blocks it) and logs `[trusted-types] script-url-refused`                         |
| D11 | bug-reports        | How long a user agent may be            | 512 characters, Minigames' bound                                                                           |
| D12 | bug-reports        | How often stored reports are refiled    | Every 15 minutes, on the every-minute cron                                                                 |
| D13 | bug-reports        | How many a refile files                 | 20, oldest first                                                                                           |
| D14 | bug-reports        | How a screenshot is fitted to 1 MB      | WebP (JPEG where unsupported), quality 0.9 stepping down by 0.1 to 0.4, then refused                       |
| D15 | bug-reports        | Which board column a report lands in    | The first column of the first live board on the tab that takes Bug Report cards                            |
| D16 | bug-reports        | How the card's fields are found         | By label, case apart; a missing field's value goes into Details under its label                            |
