# Review operator access

Every quarter, check that only what should reach production can, and that every way in is locked properly.
Part of the [ISMS](../specs/033-information-security/isms.md); the result goes to the ISMS record store as
`YYYY-MM-DD-access-review.md`.

## Accounts

1. Go through each account in [Operator accounts](../specs/033-information-security/assets.md#operator-accounts), one at a time.
2. Confirm that its second factor is a passkey or security key; an authenticator app counts as partial, SMS as missing.
3. Confirm its recovery codes are stored offline, and its recovery email is an address only Webber controls.
4. List its active sessions and sign out any device that is not recognised.
5. List its members or collaborators and remove anyone who no longer needs access.

## Tokens and keys

1. List the Cloudflare API tokens; each has an owner, a purpose and the narrowest scope that works.
2. Revoke every token that is unused, unexplained or broader than its purpose.
3. List the GitHub Actions secrets and confirm each is named in the [Secrets policy](../specs/002-project-scope/secrets-policy.md).
4. List the personal access tokens and deploy keys on GitHub; revoke what is unused.
5. Confirm npm publishing still requires two-factor authentication and disallows tokens.

## Repository

1. Confirm the `main` ruleset is active and still requires the checks listed in [Deployment](../specs/016-platform/deployment.md#ci).
2. Search the GitHub security log for ruleset bypasses since the last review, and write each one down with its reason.
3. Confirm secret scanning and push protection are on, and private vulnerability reporting is enabled.
4. Confirm no high or critical CodeQL or Dependabot alert is older than 14 days.

## Devices

1. For each operator device, confirm full-disk encryption is on.
2. Confirm the screen locks within 5 minutes and the system is on a supported, updated version.
3. Confirm operator token files under `~/.secrets/` are mode 600.

## Close

1. Write the findings and what was changed into the record.
2. Rescore any risk in the [risk register](../specs/033-information-security/risk-register.md) the findings shift, in a pull request.
