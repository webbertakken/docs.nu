# Test a restore

Every 6 months, prove that D1 and a document room can be brought back to an earlier minute.
Part of the [ISMS](../specs/033-information-security/isms.md); the result goes to the ISMS record store as
`YYYY-MM-DD-restore-test.md`.

The test runs on a pull request preview, never on production: a preview has its own workers, D1 and R2
([Preview deployments](../specs/016-platform/preview-deployments.md)).
During an incident the same steps run against production, from `apps/api` without `--env`.

## D1

1. Open a draft pull request so a preview deploys; its D1 database is `docs-nu-pr-<n>`.
2. Create a document in the preview, and note the time in UTC.
3. Wait two minutes, then delete the document from its Trash so it is gone for good.
4. Read the bookmark for the noted time: `pnpm exec wrangler d1 time-travel info <database> --timestamp=<time>`.
5. Restore to it: `pnpm exec wrangler d1 time-travel restore <database> --timestamp=<time>`.
6. Confirm the document is listed again in the preview's Explorer.
7. Write down how long the restore took and the bookmark it printed.

## Document room

LiveDoc has no operator hook yet that triggers a room's point-in-time recovery, so this part cannot run today.
Until the hook exists, record the room test as **not run**; the gap is tracked against `R-06` and control 8.13.
Once it exists, the test is:

1. In the same preview, open a document, type a recognisable line, and note the time in UTC.
2. Wait two minutes, then delete that line.
3. Restore the room to the noted time through the hook, which reads the bookmark with `ctx.storage.getBookmarkForTime`,
   sets it with `ctx.storage.onNextSessionRestoreBookmark`, then aborts the object so its next session starts from it.
4. Confirm the line is back when the document is opened again.
5. Write down how long the restore took.

## Close

1. Close the draft pull request so its preview is deleted.
2. Record pass or fail for D1 and for the room.
3. A failure is an incident against `R-06`: follow [Respond to a security incident](respond-to-a-security-incident.md).
4. When a step above no longer matches the tools, fix this instruction set in a pull request.
