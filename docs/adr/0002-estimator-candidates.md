# ADR 0002: Ability-estimator candidates remain exploratory

- Status: Accepted for exploratory simulation; not accepted for production
- Date: 2026-08-12
- Scope: `paper-3pl-v1` item parameters and response model

## Decision

The estimator comparison must keep the administered items and responses fixed. The exploratory candidate set is:

1. EAP with a truncated numerical grid `[-6, 6]` and normal priors `N(0, 1)` and `N(0, 2^2)`;
2. MAP with the same two priors and bounds;
3. bounded MLE on `[-6, 6]`; and
4. bounded unidimensional Warm WLE on `[-6, 6]`.

The response probability and expected item information remain the 3PL definitions in ADR 0001, including `D = 1.702`. No candidate changes the production application in this phase.

## Mathematical contract

For administered item set `A`, responses `u_i`, and item success probability `P_i(theta)`, the common log likelihood is

```text
ell(theta) = sum[i in A] {u_i log P_i(theta) + (1-u_i) log(1-P_i(theta))}.
```

EAP is the posterior mean obtained by normalizing the posterior density on the fixed `0.01` grid. MAP maximizes `ell(theta) + log pi(theta)`. MLE maximizes `ell(theta)`.

The unidimensional Warm WLE maximizes

```text
ell_W(theta) = ell(theta) + 0.5 log I_A(theta),
I_A(theta) = sum[i in A] I_i(theta).
```

This is the likelihood weighted by the square root of administered-test Fisher information. It is not the legacy shortcut and it is not an EAP estimate under the normal operational prior. Warm's method targets first-order MLE bias; later work establishes finite WLE estimates for constant response patterns in dichotomous 1PL–4PL models.

The implementation first evaluates the entire `0.01` grid to locate a global candidate region, then refines the interior maximum by golden-section search. A maximum at `-6` or `6` is retained and explicitly reported as a boundary hit; the bound must never be interpreted as a finite unbounded MLE.

## Uncertainty contract

- EAP reports posterior standard deviation.
- MLE and Warm WLE report `1 / sqrt(I_A(theta_hat))` only under the explicit name **local information-equivalent standard deviation**.
- MAP currently reports no scalar uncertainty.

These quantities are not interchangeable. In particular, the information-equivalent value is not by itself a demonstrated sampling RMSE, confidence-interval coverage result, or stopping-rule guarantee.

## Why estimator and stopping rule are evaluated jointly

Published CAT comparisons show that estimator bias rankings can change between fixed-length and fixed-standard-error stopping. Therefore an estimator may not be promoted from fixed-response fixtures alone. The next simulation must use common item/response paths for point-estimator isolation and must subsequently cross estimator, item selection, and stopping rule under pre-fixed criteria.

The bank diagnostic also shows that endpoint information is sparse. WLE may reduce an estimator pathology, but no estimator can manufacture absent item information. Range reporting or newly calibrated endpoint items remains a separate requirement.

## Primary references and implementation evidence

- Warm, T. A. (1989). *Weighted likelihood estimation of ability in item response theory*. Psychometrika, 54, 427–450. https://doi.org/10.1007/BF02294627
- Magis, D., & Verhelst, N. D. (2017). *On the finiteness of the weighted likelihood estimator of ability*. Psychometrika, 82, 162–175. https://doi.org/10.1007/s11336-016-9518-9
- `mirt` unidimensional WLE source, which implements the objective as log likelihood plus the log square root of test information: https://rdrr.io/cran/mirt/src/R/fscores.internal.R
- `catR::thetaEst` estimator contract: https://search.r-project.org/CRAN/refmans/catR/html/thetaEst.html
- Wang, T., Hanson, B. A., & Lau, C.-M. A simulation comparison of ability estimators and stopping rules in CAT: https://files.eric.ed.gov/fulltext/ED439156.pdf

## Promotion gate

Production promotion requires all of the following:

1. independent numerical agreement with the base-R reference fixtures;
2. estimator sensitivity results on identical administered paths;
3. estimator-by-stopping-rule simulation including bias, RMSE, boundary rate, interval calibration where applicable, test length, content constraints, and exposure;
4. an explicit range-reporting policy for poorly identified endpoints; and
5. a new frozen confirmation plan and pass decision. Exploratory results cannot be reused as confirmatory evidence.
