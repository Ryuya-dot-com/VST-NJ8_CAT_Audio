# Range-reporting exploratory decision criteria v1

Status: locked before the first full execution of `range-reporting-exploratory-v1`; exploratory and not production-validating

## Purpose

This experiment asks whether a posterior range classifier can prevent unsupported numerical reporting while retaining usable, calibrated numerical scores well inside the proposed range. It does not treat the full-bank information boundary as an observed CAT performance boundary.

The experiment compares 36 candidates on common generated response paths:

- fixed lengths 20 and 30 with randomesque-5 selection;
- EAP posteriors with `N(0,1)` and `N(0,2)` priors;
- full-bank information-equivalent SD thresholds `.25`, `.30`, and `.35`; and
- posterior classification-mass thresholds `.80`, `.90`, and `.95`.

The selection posterior remains `N(0,1)` for every path. Reporting-posterior alternatives therefore cannot change the administered items within a path.

## Theta design and boundary zones

The 27 theta conditions cover `-4.25` through `4.25` and include the independently calculated information-boundary locations and their neighborhoods. Each path rule uses 500 replications per condition, giving 27,000 generated CAT paths and 486,000 posterior candidate evaluations.

For each information-support range, conditions at least `.50` theta units outside a boundary are `clearly-outside`; conditions at least `.50` units inside both boundaries are `validated-interior`. The remaining conditions form a `boundary-indifference` zone. Boundary-zone results are reported but do not decide candidate passage. This margin was fixed before execution to avoid declaring a classifier wrong for uncertainty close to a provisional boundary.

## Classification gates

A candidate passes only if every eligible theta cell meets all gates:

1. In every clearly-outside cell, the upper 95% Wilson bound for false numerical reporting is at most `.05`.
2. In every theta cell, the upper 95% Wilson bound for classification as the opposite extreme is at most `.01`.
3. In every validated-interior cell, the lower 95% Wilson bound for numerical-report availability is at least `.90`.

Wilson score bounds are used rather than Wald bounds because zero and one observed rates must not be assigned zero uncertainty.

## Reported-score gates

Score performance is calculated both on all paths and conditionally on paths classified `within-range`. The latter is the relevant estimand because only those paths would receive numerical scores; this exposes selection-induced bias instead of hiding it.

In every validated-interior cell:

1. `abs(theta bias) + 1.96 * MCSE <= .10`;
2. `theta RMSE + 1.96 * MCSE <= .30`; and
3. the 95% Wilson intervals for empirical theta-interval coverage and monotonically transformed `paper-3pl-v1` interval coverage must both be fully contained in `[.925, .975]`.

Vocabulary-model-score bias and RMSE are reported in 0–8000 units but have no independent pass threshold. A single fixed tolerance in those units would be misleading because the nonlinear transform has strongly theta-dependent slope and saturates near 8000.

## Candidate preference and separation from confirmation

If more than one candidate passes, the frozen preference order is:

1. widest information-support interval;
2. shortest fixed length;
3. highest posterior-mass threshold; and
4. posterior specification ID as a deterministic tie-break.

An exploratory winner is not production-approved. One candidate must be frozen in a new plan and repeated with an independent seed and at least 5,000 replications per theta. Model misspecification, item-parameter uncertainty, local dependence, subgroup invariance, operational population weighting, security, and audio-mode calibration remain separate gates.
