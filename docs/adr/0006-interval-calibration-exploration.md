# ADR 0006: Interval calibration must target the complete selective reporting procedure

- Status: Accepted; all exploratory interval methods rejected for confirmation
- Date: 2026-08-12
- Scope: `interval-calibration-exploratory-v1`

## Decision

Do not select any of the five evaluated interval procedures for production or independent confirmation. Preserve the distinction between an interval calibrated over all generated CAT paths and coverage evaluated only after the numerical-reporting selection rule has been applied.

The precommitted experiment generated 128,000 CAT paths with calibration and evaluation seeds separated. None of the ten candidate-method combinations passed every frozen gate. The closest fixed-30 methods had good observed bias, RMSE, availability, and width, but failed the required Wilson evidence bounds for conditional coverage or one-sided misses in at least one theta cell.

Do not relabel near-passes as successes, pool theta cells after inspection, weaken the equivalence region, or ignore the tail-balance gate. Any such choice requires a new, explicitly justified exploratory protocol.

## Numerical audit

The likelihood and Warm calculations do not rely on a simplified proxy. The engine evaluates the full 3PL path likelihood on the frozen `[-6,6]` grid at `.01`, computes Warm's weighted objective as `log L + 0.5 log I`, and inverts pointwise likelihood-ratio acceptance regions. Fixed response paths, including all-correct and all-incorrect boundaries, match an independent base-R calculation.

The term “profile likelihood” is deliberately not used: this one-dimensional fixed-item-parameter calculation has no nuisance parameter to profile out. The ordinary likelihood-ratio label is mathematically narrower and more accurate.

## What the failure means

Simulation-calibrated LR, Warm, and EAP Neyman constructions did not uniformly validate the complete selective report. Their calibration distributions included all generated paths at each theta. The reported-path evaluation then conditioned on posterior range classification, interval validity, containment of the EAP estimate, and both endpoints lying inside the information-support range. Conditioning on these data-dependent events may change the sampling distribution and coverage.

Thus there are now three separate objects:

1. an information-support range derived from the item bank;
2. a data-dependent rule deciding whether a numerical score is reportable; and
3. an interval whose target coverage may be unconditional or conditional on that reporting event.

The third object cannot be validated independently of the second when the public claim is conditional.

## Consequences

- Keep all output marked `exploratory-not-for-score-reporting`.
- Do not change the current application scoring output from this experiment.
- Do not start a nominal confirmation simply because point estimates fall within the frozen tolerance region.
- Treat the 8000-scale endpoint transform as monotone propagation only; it preserves coverage events and cannot repair theta-scale miscalibration.
- Continue to regard direct exposure control as a separate security issue rather than part of interval repair.

## Next experiment

Before coding, state the desired public estimand and coverage claim. If numerical results are only shown after a reportability event, construct and evaluate a selective interval for that full event, with calibration and final evaluation still separated. Include a power analysis for the Wilson equivalence and tail gates so the chosen replication count can support the intended decision. Only a complete rule that passes a new exploration may enter a precommitted 5,000-plus-per-theta confirmation.
