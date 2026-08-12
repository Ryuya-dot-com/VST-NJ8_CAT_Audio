# Selective numerical-reporting design v1

Status: design decision before implementation; not an executable simulation plan and not production-validating

## Primary inferential target

For fixed true ability `theta`, let `Y` denote the complete adaptive response path and let `S(Y)=1` mean that the predeclared posterior range classifier returns `within-range` and the EAP point estimate lies inside the fixed information-support range. The primary interval target is

`P_theta(theta in C(Y) | S(Y)=1) = .95`.

This is selective conditional coverage: the long-run coverage claim is explicitly restricted to paths on which a numerical interval is actually reported. The selection event must be computable before and independently of the candidate interval. In particular, interval width, interval endpoints, connectivity, and containment of the point estimate must not decide whether the interval is shown.

The aggregate false coverage-statement rate (FCR) will be reported as a secondary diagnostic, not used as the primary gate. FCR is appropriate for a family of parameters selected for reporting, but average control could conceal serious undercoverage at a particular ability level. This test reports one person parameter per selected examinee and makes a conditional 95% claim across fixed theta, so per-theta selective coverage is the stronger and relevant requirement. The extra EAP containment clause is interval-independent and prevents a displayed point estimate from falling outside the supported numerical interval.

## Frozen scope for the next implementation

Only the fixed-30, randomesque-5, reporting-EAP `N(0,2)`, information-SD `.25`, posterior-mass `.95` contract advances. The fixed-20 contract is dropped because the previous experiment found conditional bias or width failures in addition to coverage failures. Direct exposure control remains a separate security workstream; it is not an interval-calibration parameter.

The only selection-eligible interval construction will be a conditional central EAP Neyman construction:

1. at each calibration theta, generate paths using a calibration-only seed;
2. retain paths for interval calibration only when the interval-independent classifier has `S(Y)=1`;
3. calculate simultaneous conservative lower and upper order statistics of the selected EAP estimates, using Bonferroni allocation across every calibration-theta endpoint so the estimated acceptance envelope has a predeclared familywise confidence level;
4. replace ordinary isotonic averaging with conservative monotone envelopes: lower acceptance limits may only move downward and upper limits may only move upward;
5. for a new selected path, invert the theta-indexed acceptance limits;
6. replace any gaps in the accepted theta set by its convex hull, which can only increase coverage;
7. include the EAP point in the hull if necessary, which can only widen the interval; and
8. intersect the final interval with the fixed information-support range.

For a true theta inside the information-support range, the final intersection cannot remove the true value from an otherwise covering interval. If inversion yields an empty set, the full information-support interval is returned. That fallback is deliberately safe but will be penalized by the frozen width gates. Therefore every path with `S(Y)=1` receives an interval and the reporting event remains exactly `S`, avoiding the circular selection rule in the preceding experiment.

The fraction of selected paths requiring an empty-inversion full-range fallback is separately gated at `.01` using the upper 90% Wilson bound. It is not allowed to disappear inside an always-valid interval flag.

The current equal-tail EAP posterior interval may be retained only as a diagnostic baseline. It cannot be selected, and no likelihood/Warm variant will be added to this experiment. The point estimator, acceptance statistic, and interval are thereby aligned around the same EAP estimand instead of combining an EAP point with an unrelated likelihood center.

## Evaluation and Monte Carlo evidence

Calibration and evaluation seeds remain independent. Calibration theta cells comprise the exact two information-support endpoints plus the `.25` grid points from `-2.75` through `3.25`. Each cell must obtain 2,500 selected paths before a frozen cap of 250,000 generated paths; failure to reach the target invalidates the candidate.

The simultaneous order-statistic ranks must be computed by exact binomial inversion in the executable plan; they are not plug-in `2.5%` and `97.5%` sample quantiles. With 27 calibration theta cells, 2,500 selected paths per cell, two endpoints, and familywise alpha `.05`, the illustrative one-sided Bonferroni rank is 40 (and its symmetric upper rank 2,461): `P(Binomial(2500,.025) <= 39) = .0008594`, below `.05 / 54 = .0009259`. This propagates calibration-quantile uncertainty instead of treating simulated cutoffs as known constants.

Final evaluation uses fixed generated-path counts, not a sample stopped after a fixed number of selections. The exact information-support endpoints each receive 100,000 paths; theta `-2.5` receives 15,000; theta `3.0` receives 10,000; and the ten cells from `-2.0` through `2.5` by `.5` each receive 3,000. Every one of these 14 within-range cells must yield at least 2,500 numerically reported paths; otherwise coverage, tail, bias, and width gates automatically fail for insufficient evidence. This includes boundary-neighborhood cells rather than silently exempting the locations where selection is strongest. Reportability itself is always evaluated against all generated paths.

The prior 1,000-report design was weak for the simultaneous decision it attempted. Under ideal true coverage `.95` with balanced `.025/.025` misses, exact trinomial enumeration gives:

| Reported paths per theta | One-cell pass probability | All 14 supported-theta cells |
| ---: | ---: | ---: |
| 500 | `.5677` | `.0004` |
| 1,000 | `.9403` | `.4226` |
| 1,500 | `.9903` | `.8727` |
| 2,000 | `.9987` | `.9816` |
| 2,500 | `.9998` | `.9974` |
| 5,000 | approximately `1` | approximately `1` |

These values concern Monte Carlo decision power only. They assume independent theta cells and an exactly calibrated, balanced interval; they do not show that the CAT model or interval is valid. The reproducible enumeration is in `scripts/design-selective-reporting-power.R`.

The existing gates remain unchanged unless a later executable plan gives a prospective substantive justification: 90% Wilson bounds fully inside `[.925,.975]`, each tail's Wilson upper bound at most `.05`, bias/RMSE limits, width limits, range safety, and interior reportability. Requiring every theta condition to pass is an intersection-union decision; no favorable pooling across theta is allowed.

## Limits that remain outside simulation

Even a successful selective simulation under the fitted 3PL does not address item-parameter uncertainty, multidimensionality, local dependence, subgroup DIF, temporal drift, operational theta weighting, compromised items, or audio-mode calibration. Those require empirical evidence and remain release blockers.

## Primary references

- Fithian, W., Sun, D., & Taylor, J. (2014). *Optimal Inference After Model Selection*. https://arxiv.org/abs/1410.2597 — formalizes error control conditional on a data-dependent selection event.
- Benjamini, Y., & Yekutieli, D. (2005). False discovery rate-adjusted multiple confidence intervals for selected parameters. *Journal of the American Statistical Association, 100*, 71–81. https://doi.org/10.1198/016214504000001907 — shows that intervals selected after viewing data need a selection-aware error criterion and defines FCR.
- Doebler, A., Doebler, P., & Holling, H. (2013). Optimal and most exact confidence intervals for person parameters in item response theory models. *Psychometrika, 78*, 98–115. https://doi.org/10.1007/s11336-012-9290-4 — motivates test-inversion intervals because normal approximations can under-cover for short and medium tests.
