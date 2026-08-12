# ADR 0005: Range classification is necessary but insufficient for numerical reporting

- Status: Accepted; all exploratory candidates rejected for confirmation
- Date: 2026-08-12
- Scope: `range-reporting-exploratory-v1`

## Decision

Retain the four-class posterior range contract as an exploratory safety mechanism, but do not select a scoring-and-reporting candidate and do not start a nominal confirmation run.

The precommitted experiment evaluated 36 candidates over 27,000 common-path CAT administrations and 486,000 candidate-posterior evaluations. All candidates failed at least one frozen gate. Twenty failed only interval calibration, but “only” does not make that failure optional: a numerical score without a calibrated uncertainty statement still presents unsupported precision.

Do not relax the `.925–.975` conditional coverage region, replace Wilson bounds with zero-width Wald bounds, enlarge the boundary-indifference zone, or choose a favorable subset of theta cells after observing the results. Any such change would be a new exploratory plan.

## What worked

The narrower information-support candidates usually prevented false numerical reporting outside the range while preserving numerical availability well inside it. Twenty- and thirty-item candidates also met the predeclared conditional bias and RMSE limits in most combinations. This supports continued development of the range classifier.

The classifier is conservative near a boundary, often returning `indeterminate`. That is intended: uncertainty close to a provisional limit should withhold a point claim rather than force a directional label.

## What failed

Equal-tail EAP posterior intervals were not uniformly conditionally calibrated over fixed true theta. Observed validated-interior coverage ranged from `.918` to `.9896` across candidates. The failure occurred under the generating 3PL model itself, before adding item-parameter uncertainty, misspecification, local dependence, or population shift.

The monotone `paper-3pl-v1` transformation preserves equal-tail coverage events exactly. Therefore an 8000-scale interval cannot repair theta-scale miscalibration by transformation; it carries the same coverage failure into a less linear reporting unit.

## Engineering consequence

Keep these separations explicit:

1. item-bank information support describes where the bank contains local model information;
2. posterior range classification controls whether a numerical report is attempted;
3. the point estimator controls conditional bias and RMSE; and
4. the interval procedure controls uncertainty calibration.

No single threshold substitutes for the other three components.

## Next experiment

Create a new, precommitted interval-calibration exploration on stored/common paths. At minimum compare:

- the current equal-tail EAP interval as baseline;
- a simulation-calibrated interval with calibration and evaluation seeds separated; and
- a likelihood-based or Warm-WLE-compatible interval whose finite-sample behavior is explicitly simulated.

Report conditional coverage, width, tail imbalance, bias/RMSE among numerically reported paths, and range-classification availability. Calibration must not use the final confirmation paths. Only a complete range, point, and interval rule that passes the new exploratory gates may be frozen for at least 5,000 independent replications per theta.

Direct item exposure remains secondary at this stage. Fixed 30 increased maximum marginal exposure from `.363` to `.417` in this design, so test length is not a security remedy.
