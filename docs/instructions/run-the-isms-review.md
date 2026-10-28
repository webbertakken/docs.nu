# Run the ISMS review

Once a year, check that the [ISMS](../specs/033-information-security/isms.md) still fits LiveDoc, works, and improves.
This is the management review; with one operator it also stands in for the internal audit.
The result goes to the ISMS record store as `YYYY-MM-DD-isms-review.md`.

## Inputs

1. Collect the records of the past year: incidents, access reviews, restore tests and the supplier review.
2. Confirm each cadence in [Cadence](../specs/033-information-security/isms.md#cadence) ran on time; list any that did not.
3. List what changed in LiveDoc since the last review: new data stores, suppliers, features that hold personal data.

## Check

1. Re-read the scope and interested parties; change them if LiveDoc changed.
2. Measure each [objective](../specs/033-information-security/isms.md#objectives) and write down the figure.
3. Walk the [assets](../specs/033-information-security/assets.md) against `wrangler.toml`, the Privacy Policy and the
   operator accounts actually in use; add or remove rows.
4. Rescore every risk in the [risk register](../specs/033-information-security/risk-register.md).
5. Walk every row of the [Statement of Applicability](../specs/033-information-security/statement-of-applicability.md)
   that is not Implemented or Excluded, and move it forward or say why not.
6. Pick three Implemented controls at random and check their evidence still holds.

## Decide

1. Write down what to change, each as an issue or a pull request.
2. Write down what Webber learnt about security this year and what changed because of it (control 6.3).
3. Decide whether certification is now worth pursuing ([Towards certification](../specs/033-information-security/isms.md#towards-certification)).

## Close

1. Update the specs in this category in one pull request.
2. Link it from the record and close the record.
