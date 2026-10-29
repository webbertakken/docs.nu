# Sign-in encouragement

How LiveDoc invites a guest to make an account: quietly, in place, where an account would actually help. Never a
wall: the canvas and the Explorer keep working without signing in (see [Auth + guest access](auth-and-guest-access.md)).

## Goals

- Let a guest find sign-in whenever they want it, and learn what it brings at the moment it matters.
- Never push: nothing floats over the work, nothing appears on a timer, nothing needs dismissing.

## Where sign-in is offered

Every offer below shows only where the deployment offers sign-in (`useSignInAvailable`) and the visitor is not signed
in. A guest-only install ([Open source + distribution](../002-project-scope/open-source-and-business-model.md)) shows
none of them.

- **The account control** in the Explorer header and the editor's chrome: a **Sign in** button
  ([Auth + guest access](auth-and-guest-access.md)).
- **The Explorer sidebar**: the "Sign in to access Teams" card at the end of the Spaces group, where team rows would
  be ([Explorer structure](../013-workspace/explorer-structure.md), [Teams](../013-workspace/teams.md)).
- **The editor's Explorer panel**: the persistence note, "Sign in to keep your documents across devices", which a
  guest may close for good.
- **Home's first run**: "Nothing here yet? Sign in", for someone who has used LiveDoc in another browser
  ([Explorer home](../013-workspace/explorer-home.md)).
- **Settings**: the profile card says what signing in brings, and rows that need an account carry a sign-in link
  ([Account settings](profile-and-email-notifications.md)).
- **Assign Action**: a guest may assign only themselves, with a sign-in nudge
  ([Assigned actions](../012-collaboration/assigned-actions.md)).

## No banner

There is no floating sign-in banner and no "why sign in" modal. A bottom-of-screen card ("Sign in to access Teams &
AI") once showed on the Explorer at once and in the editor after five minutes; it was removed on 29 October 2026 as
too pushy. New encouragement takes one of the in-place forms above: it sits where the account-only thing would be, and
never covers the canvas or the Explorer.

## Telemetry

Anonymous events only ([Telemetry + public transparency dashboard](../017-telemetry/telemetry.md)):

- `UI` / `Opened` / `ActionSignInNudge`: a guest opened Assign Action and saw its sign-in nudge.
- `Home` / `Selected` / `Welcome.SignIn`: Sign In chosen on Home's first run.

The banner's events (`UI` `Selected` / `Closed` `SignInBanner<Surface>`, `UI` `Opened` `SignInReasons<Surface>`, and
their older spellings without the surface) are retired ([Telemetry](../017-telemetry/telemetry.md#retired-features)).
