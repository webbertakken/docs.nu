# Information security management system

LiveDoc keeps an information security management system (ISMS) shaped on ISO/IEC 27001:2022.
It is **aligned, not certified**: every clause and Annex A control is addressed, but no certification body audits it.
Certification is a later, separate decision, taken when a customer or contract requires it (see "Towards certification").

## Scope

- **In scope:** the development and operation of the hosted service at docs.nu, its subdomains and its previews.
- In scope too: the public repository `webbertakken/livedoc`, its CI and deploy pipeline, and the npm scope `@livedoc`.
- In scope too: the operator accounts that can change any of the above, and the devices those accounts are used from.
- **Out of scope:** copies of LiveDoc that others self-host; their operator runs their own ISMS.
- Out of scope too: the [upstream project](../002-project-scope/livediagram-upstream.md) and its infrastructure.
- Out of scope too: the internal controls of suppliers, which are managed through supplier review instead.

## Context

- LiveDoc is a free hosted service run by one person, Webber, on Cloudflare's serverless platform.
- The code is public and MIT-licensed, so security rests on keys and configuration, never on obscurity.
- The canvas works without an account, so guests hold the same data rights as signed-in people.
- Documents can hold anything a person types, so all document content is treated as Confidential.

## Interested parties and their requirements

| Party                      | Requirement                                                                                                        |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| People using docs.nu       | Their documents stay confidential, intact and available; they can delete them.                                     |
| People given a share link  | The link grants exactly its role, and stops working when revoked or expired.                                       |
| Data protection law (GDPR) | Lawful processing, the rights of data subjects, breach notification.                                               |
| Google API Services policy | Limited Use of Google user data from sign-in and the Drive mirror.                                                 |
| Suppliers                  | Use within their terms (Cloudflare, Google, Resend, OpenAI, GitHub, npm).                                          |
| Security researchers       | A private channel and safe harbour ([Vulnerability disclosure](../002-project-scope/vulnerability-disclosure.md)). |
| Self-hosters               | Secure defaults and no secrets in source ([Secrets policy](../002-project-scope/secrets-policy.md)).               |

## Roles

- **Webber** is top management, ISMS owner, risk owner of every risk, and the only operator with production access.
- Agents working on the repository act under Webber's accounts and authority; they hold no standing access of their own.
- Segregation of duties cannot exist with one person, so it is compensated (see `5.3` in the
  [Statement of Applicability](statement-of-applicability.md)).

## Information security policy

1. Document content, account data and secrets are protected by default; access is granted per request, never assumed.
2. No secret lives in source, ever ([Secrets policy](../002-project-scope/secrets-policy.md)).
3. Every change to production goes through a pull request and green CI; nothing is deployed by hand except recovery.
4. Every operator account that can reach production uses strong, phishing-resistant multi-factor authentication.
5. Data is kept only as long as the [Privacy Policy](../../../apps/help/app/policies/privacy-policy/page.mdx) states.
6. Every security event is logged, assessed and, when it is an incident, handled and learnt from.
7. Risks are assessed on every change that shifts them and reviewed in full once a year.
8. The ISMS improves continually: each review, incident and audit finding becomes a change to these specs.

## Objectives

Each objective is measurable and checked at the yearly management review.

| Objective                                | Measure                                                              | Target |
| ---------------------------------------- | -------------------------------------------------------------------- | ------ |
| Operator accounts are hard to take over  | Production-reaching accounts with phishing-resistant MFA             | 100%   |
| Known vulnerabilities do not linger      | Open high or critical Dependabot or CodeQL alerts older than 14 days | 0      |
| Data can be brought back                 | Restore tests passed in the last 6 months, D1 and room storage       | 1 each |
| Incidents are handled, not just survived | Incidents with a closed post-incident review                         | 100%   |
| Reviews happen                           | Recurring reviews done on time (see "Cadence")                       | 100%   |

## Records

- The specs in this category are the ISMS's documented information; they are public on purpose.
- **Records** are the evidence that the ISMS runs: incident logs, access reviews, restore tests, supplier reviews,
  management reviews and internal audits.
- Records can name people, accounts and weaknesses, so they never go into this public repository.
- Records live in the private **ISMS record store**, the repository `webbertakken/livedoc-isms-records`.
- Each record is one dated Markdown file in the folder for its kind, kept for at least 3 years.

## Cadence

| Process                                                                                | When                          |
| -------------------------------------------------------------------------------------- | ----------------------------- |
| [Respond to a security incident](../../instructions/respond-to-a-security-incident.md) | On every security event       |
| [Review operator access](../../instructions/review-operator-access.md)                 | Every quarter                 |
| [Test a restore](../../instructions/test-a-restore.md)                                 | Every 6 months                |
| [Review suppliers](../../instructions/review-suppliers.md)                             | Every year, and on adding one |
| [Run the ISMS review](../../instructions/run-the-isms-review.md)                       | Every year                    |

## Towards certification

Certification adds what alignment leaves out, all of it outside this repository:

- an **independent internal audit**, since Webber cannot audit his own ISMS;
- at least 3 months of records produced by the cadence above;
- a Stage 1 and Stage 2 audit by an accredited certification body, then yearly surveillance and recertification every 3 years.
