# Respond to a security incident

How a security event is triaged and, when it is an incident, handled and learnt from.
Part of the [ISMS](../specs/033-information-security/isms.md); records go to the private ISMS record store, never this repository.

## Triage

1. Open a record named `incidents/YYYY-MM-DD-incident-<slug>.md` in the ISMS record store, and note the time the event was seen.
2. Write down where it came from: a vulnerability advisory, a CodeQL or Dependabot alert, a log line, a supplier notice, a user.
3. Decide whether it is an **incident**: confidentiality, integrity or availability of an [asset](../specs/033-information-security/assets.md) is harmed or about to be.
4. If it is not, write why in the record, close it, and stop here.
5. Decide whether **personal data** is involved: any Confidential data store, account data, or an operator account that reaches one.
6. Rate the severity: **high** when personal data or a Secret is exposed, **medium** for an outage or a contained flaw, **low** otherwise.

## Contain

1. A leaked secret: rotate it at its provider first, then everywhere it is stored ([Secrets policy](../specs/002-project-scope/secrets-policy.md#if-a-secret-leaks)).
2. A taken-over operator account: reset its password, revoke its sessions and tokens, re-enrol its second factor.
3. An exploitable flaw: ship the fix through a pull request; when waiting is worse, roll the worker back (`pnpm exec wrangler rollback`).
4. Abuse: tighten the matching rate limiter or suspend the offending form or share link.
5. Log every command run against production in the record, with its time.

## Preserve evidence

1. Save the relevant `wrangler tail` output, Cloudflare logs and GitHub security log entries into the record store.
2. Note the deployed version id of each affected worker (`pnpm exec wrangler deployments status`).
3. Never paste Secrets or document content into the record; describe them instead.

## Recover

1. Restore data when it was damaged, following [Test a restore](test-a-restore.md) against production instead of a preview.
2. Confirm the service works: the E2E smoke run on `main` is green and docs.nu answers.

## Notify

1. If personal data was breached and harm to people is likely, notify the Dutch Data Protection Authority
   (Autoriteit Persoonsgegevens) **within 72 hours** of becoming aware, through its data breach notification form.
2. If the risk to people is high, tell the affected people directly, plainly, by email.
3. If the incident came from a vulnerability report, keep the reporter informed in the advisory and publish it once fixed.
4. If a supplier caused or shares the incident, report it to them.

## Learn

1. Within a week, write the post-incident review in the record: timeline, root cause, what worked, what did not.
2. Fold each lesson back into a spec, an instruction set or the [risk register](../specs/033-information-security/risk-register.md) in a pull request.
3. Add a regression test for the root cause when it was in code.
4. Close the record, linking the pull requests.
