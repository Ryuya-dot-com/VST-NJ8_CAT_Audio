# Direct exposure control — exploratory v1

Status: **exploratory; unconditional SH is not production-ready**

Plan: `exposure-control-exploratory-v1`

Seed: `20260813`

Result SHA-256: `fdba2b5b6f637d9e28ede754522849f90aaa578d60f446f05a5445f7ad2a1c35`

## Design

The run used 15 equally weighted true-theta cells from `-3.5` to `3.5`. Each of three fixed-20 designs used eight unconditional Sympson–Hetter calibration cycles with 200 replications per theta, followed by an independent evaluation with 500 replications per theta.

This totals 72,000 calibration CATs and 22,500 evaluation CATs. Evaluation paths were scored by EAP `N(0,1)` and Warm WLE. The target maximum marginal item exposure was `.25`.

## Results

| Design | Maximum marginal exposure | Items above .25 | Maximum theta-conditional exposure | Unused items | Mean rejections/test | EAP worst bias | EAP max RMSE | EAP min coverage | WLE worst bias | WLE max RMSE |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| High Levels 7–8 ≥ 2 | .256 | 11 | 1.000 | .044 | 1.993 | .407 | .513 | .808 | .138 | .531 |
| Low/middle/high ≥ 2 each | .259 | 14 | 1.000 | .056 | 2.551 | .399 | .483 | .822 | .126 | .522 |
| Every level ≥ 1 | .260 | 12 | .998 | .044 | 2.479 | .440 | .535 | .800 | .179 | .555 |

All blueprint violation rates and forced-fallback rates were zero. Expected pairwise overlap rates computed from marginal exposures were `.174`, `.179`, and `.180`, respectively.

At a marginal exposure near `.25` with 7,500 evaluation CATs, the binomial MCSE for one preselected item is about `.005`. The maximum is selected across 160 items, so this calculation does not license treating the observed `.256–.260` maxima as a pass. Under the exact existing engineering gate, all three designs fail.

## What the experiment establishes

1. Direct calibration materially reduced maximum marginal exposure from the earlier randomesque-5 value of `.356` to approximately `.26`.
2. Eight SH cycles did not achieve the exact `.25` evaluation gate. A lower calibration target or a more stable conditional method is required.
3. Marginal control concealed severe conditional concentration: at some theta values one item was administered in virtually every CAT.
4. The three-band constraint was less damaging than requiring every level. The every-level rule is rejected as an unsupported mechanical blueprint.
5. Exposure control did not repair endpoint measurement. Warm WLE low-end RMSE remained above `.52`, and standard-normal EAP coverage remained at or below `.822` in the best constrained design.
6. Zero forced fallbacks show that the exposure probability experiment remained feasible for these simulations; this does not establish operational feasibility under bank depletion or changed constraints.

## Decision

Do not deploy these SH parameters. Preserve the three-band rule only as an exploratory content candidate. The next study should control exposure conditional on estimated-theta regions, use an undershot calibration target such as `.24` as a candidate rather than silently relaxing `.25`, and evaluate test overlap directly. Endpoint range reporting and new calibrated items remain higher-priority validity requirements.
