# Open source + distribution

docs.nu is **open source software** (MIT), hosted free for everyone at
[docs.nu](https://docs.nu), with **usage-based plans** for power users. Plans
exist to pay for hosting; they never buy features.

## License

The codebase is licensed under **MIT** (see `LICENSE` at the repo root). Permissive on purpose: anyone may self-host,
modify, embed, or build derivative works, commercial or not. No copyleft.

The third-party work the apps ship is credited on the generated `/licences` page ([Third-party licences](third-party-licences.md)).

## Distribution model

There are two ways people use docs.nu:

1. **Hosted at docs.nu.** Free for everyone, generously. Above a certain usage, a person can subscribe to a plan for
   more usage.
2. **Self-hosted.** Clone the repo and run it on their own Cloudflare account (or anywhere the apps are runnable). Every
   feature, no plan, no limit but their own, no license check, no SaaS dependency required (Clerk is optional, see
   [Auth + guest access](../014-identity/auth-and-guest-access.md)).

Both paths get the same feature set.

### Self-hosting, contributing, forking

- **Self-hosting is highly encouraged** for anyone who wants full control over their data. It is a first-class path,
  documented and kept working, not a courtesy.
- **Contributing is the way to change docs.nu.** Improvements are welcome back under the same MIT license, so everyone
  gets them.
- **Forking is allowed and not encouraged.** The license permits it; the project would rather have the change in
  docs.nu itself.

## Plans

- **Free comes first.** Nobody chooses a plan to start; nobody meets a price before they have used the product.
- **Plans are found under Usage**, in the menus, beside what a person has used. They are not on the marketing pages,
  and nothing in the product nudges toward them before usage approaches the free amount.
- **A plan buys usage, never features.** No feature is gated on a plan; the codebase holds no "Pro features" flag.
- **A plan pays for hosting.** Its price follows what hosting costs, not what the market would bear.

## Implications for how we build

- **No license checks.** No feature sits behind a server call, license string or telemetry that breaks self-hosting.
- **Plans are a hosted concern.** Billing and usage limits are optional, each gated on its own configuration; a
  self-hosted deployment without them runs with no limits and no billing code path in reach.
- **Optional SaaS, not required SaaS.** The OSS core never calls home. Its SaaS integrations are all optional, each
  gated on its own key: Clerk for auth ([Auth + guest access](../014-identity/auth-and-guest-access.md)), Resend for
  email ([Transactional & lifecycle email (Resend)](../014-identity/transactional-email.md)), a model provider for the
  AI assistant ([AI Assistance](../007-editor/ai-assistance.md)), and billing for plans. When
  `CLERK_JWKS_URL` / `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` aren't set, the api worker and live frontend degrade to
  pure-guest mode and the product is fully usable.
- All design decisions assume the codebase is visible to the public, which constrains how we handle
  [secrets](secrets-policy.md).

## What this means for contributors

- External contributors can use, modify and ship docs.nu however they want.
- Contributions back to the project are welcome under the same MIT license.
- This spec does not yet cover trademark or the "docs.nu" name.
