# Interval-calibration exploratory decision criteria v1

Status: locked before the first full execution of `interval-calibration-exploratory-v1`; exploratory and not production-validating

## Why this is a new experiment

`range-reporting-exploratory-v1` remains rejected under its frozen rules. Its 500-replication design required a 95% Wilson interval for coverage to be fully contained in `[.925, .975]` at every validated-interior theta. That is a defensible high-evidence requirement, but it has low selection power at 500 replications and cannot identify whether failure comes from the interval procedure or Monte Carlo resolution.

This new experiment does not reinterpret the old result. It increases independent evaluation to 1,000 replications per theta and uses two one-sided equivalence testing logic: a 90% Wilson score interval must be fully contained in `[.925, .975]`. Calibration and evaluation random streams are separate.

## Fixed reporting candidates

Only two near-pass reporting contracts advance as exploratory inputs:

1. fixed 20, EAP `N(0,1)`, information-SD range `.25`, posterior range mass `.95`; and
2. fixed 30, EAP `N(0,2)`, information-SD range `.25`, posterior range mass `.95`.

Both continue to use `N(0,1)` EAP for adaptive item selection. The information-support boundary is fixed at theta `[-2.7578183981, 3.3090556474]`. Neither contract is a selected production rule.

## Interval methods

Five interval procedures are compared on common response paths:

1. current 95% equal-tail EAP posterior interval;
2. ordinary likelihood-ratio inversion with the fixed chi-square-one-degree cutoff `3.841458820694124`;
3. likelihood-ratio inversion with theta-specific cutoffs estimated from the calibration simulations;
4. Warm weighted-likelihood-ratio inversion with theta-specific simulation cutoffs; and
5. a Neyman construction that inverts central calibration acceptance limits for the EAP estimate.

Warm's weighted likelihood is a first-order bias-reduced point-estimation construction; it is not assumed to make a chi-square likelihood ratio. Its weighted-likelihood interval is therefore evaluated only with simulation-calibrated cutoffs.

The calibrated EAP acceptance limits are fitted monotonically by pooled-adjacent-violators regression before linear interpolation. LR cutoff curves are linearly interpolated without monotonicity assumptions. Calibration uses 1,000 replications at theta increments of `.25` from `-4.5` through `4.5`; evaluation uses a separate seed and 1,000 replications at 27 conditions. Posterior calculation and interval inversion retain the established `paper-3pl-v1` grid `[-6, 6]` at step `.01`.

Finite-sample calibration quantiles use ordered samples with one-based rank `floor(p(n+1))` for a lower limit and `ceil(p(n+1))` for an upper limit, each clipped to `[1,n]`. Candidate contracts share random-number streams; because the two frozen candidates have the same selection prior and randomesque rule, their first 20 administered items and responses are identical within a theta-replication cell. All interval methods within a candidate use the exact same generated path.

For inversion-grid points outside the calibrated theta range, each calibration curve is held constant at its nearest calibrated endpoint. Such extrapolated endpoints cannot be numerically reported because the reportability rule below separately requires both interval endpoints to remain within the narrower information-support range.

## Reportability contract

A path is numerically reportable for an interval method only when:

- posterior range classification is `within-range`;
- the inverted interval is nonempty and connected;
- it does not touch the inversion-grid boundary;
- it contains the EAP point estimate; and
- both endpoints lie within the fixed information-support range.

Otherwise the method withholds the numerical result. This prevents a formally computed interval from silently extending beyond the range the bank is claimed to support.

## Frozen gates

Every eligible theta cell must pass:

1. clearly outside: upper 90% Wilson bound for numerical reporting at most `.05`;
2. all cells: upper 90% Wilson bound for opposite-extreme classification at most `.01`;
3. validated interior: lower 90% Wilson bound for reportability at least `.90`;
4. validated interior: upper 90% Wilson bound for invalid interval rate at most `.01`;
5. reported paths: `abs(theta bias) + 1.64485 * MCSE <= .10`;
6. reported paths: `theta RMSE + 1.64485 * MCSE <= .30`;
7. reported paths: 90% Wilson coverage interval fully contained in `[.925, .975]`;
8. reported paths: upper 90% Wilson bounds for lower- and upper-tail miss rates each at most `.05`;
9. reported paths: maximum conditional mean theta width at most `.80`; and
10. reported paths: maximum conditional 90th-percentile theta width at most `1.00`.

The transformed 8000-scale interval uses the same endpoints through the monotone paper transform, so coverage events remain identical. Its widths are reported but not compared with a single constant because scale slope varies sharply with theta.

## Selection and confirmation

If methods pass, preference is fixed first by reporting-candidate order (shorter test first), then by method order favoring the least simulation-dependent standard construction, then by maximum conditional mean theta width.

A passing result still requires a frozen independent confirmation with at least 5,000 replications per theta. Simulation-calibrated curves are versioned artifacts tied to the item bank, selection rule, length, point estimator, and generating model. Model misspecification, parameter uncertainty, local dependence, subgroup invariance, operational weighting, exposure/security, and audio calibration remain outside this experiment.

Primary theoretical anchor: Warm, T. A. (1989). Weighted likelihood estimation of ability in item response theory. *Psychometrika, 54*, 427–450. https://doi.org/10.1007/BF02294627
