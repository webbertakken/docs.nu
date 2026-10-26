-- Sign-up and sign-in are counted by the identity hooks (src/auth/identity-hooks.ts), from the server's own
-- account and session creation (docs/specs/017-telemetry/telemetry.md, Session). The first-sighting tables that
-- counted them from the previous sign-in provider's sessions have no reader or writer left.
DROP INDEX IF EXISTS auth_sessions_seen_idx;
DROP TABLE IF EXISTS auth_sessions;
DROP TABLE IF EXISTS auth_accounts;
