# Selection-adjusted point-estimation design v1

Status: design decision before implementation; not an executable simulation plan and not production-validating

## Why guard bands alone are not the primary remedy

The preceding selective-reporting experiment found inward conditional EAP bias at both information-support endpoints. Moving a display threshold inward while continuing to report the ordinary EAP would create a new selection boundary and can reproduce the same mechanism there. A narrower operational core remains a candidate safety policy, but it must be compared with estimators that explicitly account for the selection event.

## Fixed estimand and selection event

For each fixed true theta, the point-estimation target remains theta under the fitted 3PL. The selection event remains interval-independent:

`S(Y)=1` when posterior `within-range` mass is at least `.95` and ordinary `N(0,2)` EAP lies inside the candidate operational core.

All bias, RMSE, interval, and width claims are conditional on `S(Y)=1`. Selection probability and false numerical selection outside the core are evaluated over all generated paths.

## Point estimators to compare

Use common generated response paths and compare exactly three point estimators:

1. **ordinary EAP baseline** — the current `N(0,2)` EAP, retained to diagnose whether guard bands merely move the bias;
2. **selection-inverted conditional-median estimate** — invert the theta-indexed conditional distribution of the ordinary EAP among selected calibration paths at probability `.5`; and
3. **selection-adjusted conditional-likelihood estimate** — maximize
   `log L(Y | theta) - log P_theta(S=1)`
   over the operational core, with `P_theta(S=1)` estimated only from calibration paths and interpolated prospectively.

For an observed selected path `y`, the conditional likelihood is

`L_S(theta; y) = 1{S(y)=1} L(theta; y) / P_theta(S=1)`.

The selection probability is therefore part of the conditional likelihood; omitting its denominator would reproduce the unadjusted estimator. `L(theta; y)` is the product of the 3PL response probabilities along the full administered path. The adaptive item-selection factors are theta-independent given the observed history and randomization and hence cancel from likelihood ratios; `P_theta(S=1)` must nevertheless average over the complete adaptive response-and-randomization procedure. Boundary and empty-solution behavior must be explicit and separately gated.

Because CAT responses make the selected EAP distribution discrete and Monte Carlo calibration can violate theta monotonicity, the median inversion must not pretend to solve a smooth exact equation. Construct simultaneous lower and upper bounds for the selected conditional CDF, impose only order-restricted envelopes justified by stochastic ordering, and invert the resulting `.5` crossing set. Use its midpoint only when the crossing set is nonempty and bounded; otherwise record a fallback. The name “median-unbiased” is reserved for a procedure that separately demonstrates both median inequalities after accounting for atoms and calibration uncertainty.

The selection-inverted estimator is the primary candidate because its construction targets balanced conditional over/underestimation. Neither it nor the conditional-likelihood estimator is presumed unbiased in finite samples; both must pass the frozen evaluation gates.

## Operational-core candidates

Use the fixed information-support interval only as the outer envelope. Predeclare three guard-band candidates, ordered from widest to narrowest:

1. `[lower + .50, upper - .50]` = `[-2.2578183981, 2.8090556474]`;
2. `[lower + .75, upper - .75]` = `[-2.0078183981, 2.5590556474]`; and
3. `[lower + 1.00, upper - 1.00]` = `[-1.7578183981, 2.3090556474]`.

This is a finite, prospective set. Do not optimize boundaries continuously on evaluation results. Each candidate must include exact operational endpoints in calibration and evaluation, plus exterior neighbors at `.25` and `.50` beyond each endpoint.

## Calibration and evaluation separation

Use distinct seeds and versioned calibration artifacts. At every calibration theta, obtain a fixed minimum selected sample before a fixed generated-path cap. Estimate jointly:

- the selection probability curve;
- the conditional ordinary-EAP CDF or quantile grid needed for median inversion;
- the selected-EAP acceptance envelope for the interval; and
- Monte Carlo uncertainty for each estimated curve.

Calibration uncertainty must again use simultaneous exact-binomial bounds or conservative order-statistic ranks; plug-in curves are insufficient. Final evaluation paths must not alter any curve or candidate boundary.

## Frozen decision principles

- First require outside-core safety and adequate selection probability in the validated interior.
- Then require at least 2,500 selected evaluation paths at every operational-core theta cell.
- Apply the existing point bias `.10`, RMSE `.30`, conditional coverage `[.925,.975]` with 90% Wilson equivalence, per-tail `.05`, mean width `.80`, and p90 width `1.00` gates.
- Gate conditional-likelihood boundary hits and conditional-median-inversion fallback rates at `.01` by upper 90% Wilson bounds.
- Select by guard-band order first (widest valid core), then point-estimator order (conditional-median inversion, conditional likelihood); ordinary EAP cannot be selected.
- A selected combination remains exploratory and must enter a separately frozen confirmation of at least 5,000 paths per theta.

## What this experiment cannot establish

All conclusions remain conditional on fixed fitted item parameters and the unidimensional local-independence 3PL. Model misspecification, item-parameter uncertainty, DIF, operational exposure/security, and audio-mode calibration remain outside scope and release-blocking.

## Primary references

- Fithian, W., Sun, D., & Taylor, J. (2014). *Optimal Inference After Model Selection*. https://arxiv.org/abs/1410.2597 — motivates inference under the conditional law given selection.
- Heller, R., Meir, A., & Chatterjee, N. (2019). Post-selection estimation and testing following aggregate association tests. *Journal of the Royal Statistical Society: Series B, 81*, 547–573. https://doi.org/10.1111/rssb.12318 — develops selection-adjusted point estimates from conditional likelihood.
- Robertson, D. S., Choodari-Oskooei, B., Dimairo, M., Flight, L., Pallmann, P., & Jaki, T. (2023). Point estimation for adaptive trial designs II: Practical considerations and guidance. *Statistics in Medicine, 42*, 2496–2520. https://doi.org/10.1002/sim.9734 — reviews bias and bias-reduced point estimation after adaptive procedures and emphasizes prespecification.
