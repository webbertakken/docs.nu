# Risk register

The security risks to the [assets](assets.md) in the [ISMS](isms.md)'s scope, how each is treated, and what remains.

## Method

- **Likelihood** (L) and **impact** (I) are each scored 1 to 5; the **score** is L × I.
- Likelihood: 1 rare, 2 unlikely in a year, 3 possible in a year, 4 likely in a year, 5 expected.
- Impact: 1 negligible, 2 minor and short, 3 some users' data or a day's outage, 4 many users' data or a week, 5 everything.
- Scores are given **after** the controls listed beside them (residual risk).
- **Acceptance:** a residual score of 8 or less is accepted; 9 or more carries a planned treatment in the
  [Statement of Applicability](statement-of-applicability.md) and is revisited every quarter.
- A risk is added or rescored in the same pull request as the change that shifts it.

## Risks

| Id     | Risk                                                                | Controls in place                                                                                                                        | L   | I   | Score | Treatment                                                                           |
| ------ | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | --- | --- | ----- | ----------------------------------------------------------------------------------- |
| `R-01` | An operator account (Cloudflare, GitHub, registrar) is taken over   | MFA; scoped deploy token; [Review operator access](../../instructions/review-operator-access.md)                                         | 2   | 5   | 10    | Phishing-resistant keys on every account in [assets](assets.md#operator-accounts)   |
| `R-02` | A secret leaks through code, logs or CI                             | [Secrets policy](../002-project-scope/secrets-policy.md); GitHub secret scanning with push protection                                    | 2   | 4   | 8     | Accept                                                                              |
| `R-03` | A flaw in access checks exposes another person's document           | Per-request checks; share role tests ([gate by share role](../../instructions/gate-a-feature-by-share-role.md)); CodeQL; public source   | 2   | 4   | 8     | Accept                                                                              |
| `R-04` | A malicious or compromised dependency ships to production           | Lockfile; Dependabot version and security updates; CodeQL; required checks                                                               | 2   | 5   | 10    | Review each new dependency before adding it: maintainers, adoption, install scripts |
| `R-05` | Cross-site scripting through document content                       | Trusted Types enforced on the editor ([Trusted Types](../016-platform/trusted-types.md))                                                 | 2   | 4   | 8     | Accept                                                                              |
| `R-06` | A bad migration or bug corrupts or deletes data in D1 or rooms      | Migrations run first on previews; D1 Time Travel, 30 days, [tested](../../instructions/test-a-restore.md); rooms keep 30 days of history | 2   | 4   | 8     | Build an operator hook to restore a room to a point in time                         |
| `R-07` | Uploaded images are lost: R2 keeps no point-in-time copy            | Images are only deleted through the api; account and document deletes are deliberate                                                     | 2   | 3   | 6     | Accept                                                                              |
| `R-08` | Webber is unavailable and nobody can operate or recover the service | Everything is code; deploys are automated; [docs.nu deployment](../../operations/docs-nu.md) is written down                             | 2   | 4   | 8     | Accept                                                                              |
| `R-09` | Cloudflare suffers a regional or platform outage                    | None of LiveDoc's own; the editor retries a failed save ([Per-tab storage](../006-document/per-tab-storage.md))                          | 2   | 3   | 6     | Accept                                                                              |
| `R-10` | Abuse: spam forms, scraping, brute-forcing share passwords, AI cost | Rate limiters on writes, shares, guesses, AI and unfurls; form reports and suspension                                                    | 3   | 2   | 6     | Accept                                                                              |
| `R-11` | A share link reaches someone it was not meant for                   | Links are keys by design; passwords, expiry and revocation ([share links](../013-workspace/share-password.md))                           | 3   | 3   | 9     | Accept as a product trade-off; explained in the help centre                         |
| `R-12` | A supplier mishandles personal data it processes                    | Few suppliers; minimal data sent; [Review suppliers](../../instructions/review-suppliers.md)                                             | 2   | 3   | 6     | Accept                                                                              |
| `R-13` | A personal data breach is not noticed or not notified in time       | Cloudflare logs; `wrangler tail`; red-main issues; [incident response](../../instructions/respond-to-a-security-incident.md)             | 3   | 4   | 12    | Alerting on api error spikes and auth anomalies                                     |
| `R-14` | An operator device is lost or stolen with tokens on it              | Full-disk encryption; screen lock; tokens revocable                                                                                      | 2   | 4   | 8     | Accept                                                                              |
| `R-15` | A change merges to `main` without review, past the required checks  | Required checks; CodeQL threshold; Copilot review; admin bypass only through a pull request                                              | 1   | 4   | 4     | Accept with one operator; bypass use is logged in the access review                 |

## Accepted trade-offs

- `R-11`: a share link that anyone can forward is the product's promise of "open the link, start drawing".
- `R-15`: with one maintainer there is no second human to approve a pull request; CI, CodeQL and agent review stand in.
- `R-07`: images are re-creatable by their owner far more often than document content is, and R2 offers no restore.
