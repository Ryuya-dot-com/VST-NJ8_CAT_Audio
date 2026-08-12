# Selection-adjusted calibration feasibility pilot v1

## Status

Planning pilot only. Direct rejection sampling is infeasible under the frozen calibration cap, so the point-estimation evaluation has not started and no production reporting behavior changes.

## Design

- fixed-30, randomesque-5 CAT with `N(0,1)` selection EAP and `N(0,2)` reporting EAP;
- three nested operational selection cores with `.50`, `.75`, and `1.00` theta guard bands;
- corresponding estimation domains extending `.50` beyond each selection core but never beyond the information-support range;
- 13 exact boundary and neighboring theta cells, with 10,000 common generated paths per cell and candidate;
- selection event fixed as posterior information-support mass at least `.95` plus ordinary EAP inside the candidate core; and
- one-sided 90% Wilson lower bounds used to project selected counts at the frozen cap of 250,000 generated paths per calibration theta.

## Result

The pilot generated 130,000 CAT paths. Eight candidate-by-theta calibration-domain cells failed the prospective feasibility rule. The most restrictive lower-boundary results were:

- `guard-050` at theta `-2.7578183981`: 2/10,000 selected; projected lower-bound count 21/250,000;
- `guard-075` at theta `-2.5078183981`: 2/10,000 selected; projected lower-bound count 21/250,000; and
- `guard-100` at theta `-2.2578183981`: 3/10,000 selected; projected lower-bound count 36/250,000.

The corresponding upper estimation-domain endpoints also failed for all three candidates, though less severely: projected lower-bound counts were 2,224, 1,641, and 705.

## Interpretation

The `.50` estimation guard region is mathematically necessary to avoid forcing adjusted estimates to have one-sided error at the selection-core endpoints. It also places calibration theta values where the selection event is rare. Directly waiting for 2,500 selected paths would require roughly millions of CAT paths in the most difficult cells, and the frozen 250,000-path cap cannot support the planned finite-sample calibration.

This is a computational-design failure, not evidence against selection adjustment itself and not a reason to shrink the estimation domain after seeing the pilot. The full evaluation remains unopened.

## Next gate

Before any point-estimator evaluation, predeclare and validate a defensive mixture importance sampler. The proposal must include every target theta with positive mass, compute the complete adaptive response-path likelihood ratio, bound or diagnose weights prospectively, report effective sample size and Pareto-tail diagnostics, and agree with direct simulation in overlap cells. If those checks fail, abandon the selection-adjusted numerical-reporting candidate rather than relying on unstable reweighting.
