# Review suppliers

Every year, and before a new supplier processes anything, check that each supplier is fit to hold what it is given.
Part of the [ISMS](../specs/033-information-security/isms.md); the result goes to the ISMS record store as
`YYYY-MM-DD-supplier-review.md`.

## Before adding a supplier

1. Write down what it would receive, and whether that includes personal data.
2. Prefer doing without: a supplier is added only when building it in is clearly worse.
3. Continue with the steps below for it alone, then add it to [Suppliers](../specs/033-information-security/assets.md#suppliers)
   and, if it processes personal data, to the Privacy Policy's service providers, in the same pull request.

## For each supplier

1. Take the supplier list from [Suppliers](../specs/033-information-security/assets.md#suppliers).
2. Note its current certifications (ISO 27001, SOC 2 Type II) from its trust page, with the link and date.
3. For a processor of personal data, confirm its data processing terms apply to LiveDoc's account, and file a copy.
4. Note where it processes data and how it transfers data out of the EU, if it does.
5. Read its security incidents or notices since the last review and note any that touched LiveDoc's data.
6. Confirm LiveDoc still sends it no more than the Privacy Policy says.

## Close

1. Write the result per supplier into the record: keep, keep with a note, or replace.
2. Update the Privacy Policy and the [risk register](../specs/033-information-security/risk-register.md) in a pull request
   when anything changed.
