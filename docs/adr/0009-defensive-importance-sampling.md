# ADR 0009: A single-theta defensive mixture is insufficient at the lower boundary

- Status: Accepted; importance proposal rejected
- Date: 2026-08-12
- Scope: `selection-adjusted-importance-validation-v1`

## Decision

Reject the `.20` target plus `.80` adjacent-core-theta defensive mixture as the calibration engine for selection-adjusted point estimation. Do not start the estimator evaluation and do not smooth, truncate, or retune weights using the validation output.

## Evidence

The validation generated 360,000 CAT paths. It computed likelihood ratios from all administered item responses under the target and auxiliary theta values. The adaptive randomized item-selection factors cancel from the ratio because, conditional on an observed response and randomization history, the identical policy has no true-theta argument.

The implementation passed strong algebraic and overlap checks: raw weights were analytically bounded by `5`, simultaneous mean-weight intervals contained `1` in all twelve experiments, and six independent direct comparisons agreed within simultaneous empirical-Bernstein bounds.

Nevertheless, lower endpoint selected ESS was only `74.59`, `7.35`, and `238.61` from 20,000 mixture draws. One selected path carried up to `10.85%`, `34.43%`, and `2.50%` of normalized selected weight. These fail the frozen ESS and concentration limits and cannot support reliable conditional CDF inversion.

## Why bounded raw weights were not enough

The defensive target component guarantees `w(y) <= 5` for every complete path. It does not guarantee that many proposal draws enter the rare selection event, nor that selected weights are evenly distributed. Conditional estimation depends on the weighted selected subset; its effective sample size can remain negligible even when unconditional weights are bounded and have mean one.

## Consequences

- preserve `exploratory-not-for-score-reporting` and the existing production behavior;
- do not reinterpret successful upper-endpoint diagnostics as validation of the asymmetric lower endpoint;
- do not increase sample size or alter auxiliary theta values after observing these results;
- retain exact reproducibility and the failed result as a design constraint; and
- require a new frozen validation before any response-level tilting or sequential rare-event sampler is used.

Vehtari et al. (2024) emphasize that importance weighting can be unstable when the proposal misses consequential target regions and recommend ESS and weight-tail diagnostics. Here the analytical bound makes raw heavy-tail smoothing unnecessary, while selected ESS and maximum normalized selected weight directly reveal the remaining rare-event degeneracy: https://www.jmlr.org/papers/v25/19-556.html
