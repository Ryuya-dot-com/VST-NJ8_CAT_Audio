# Range-reporting exploratory simulation v1

## Status

Exploratory only. No candidate passed all frozen gates, no candidate advances to confirmation, and no production score-reporting behavior changes.

## Design

- 27 true-theta conditions from `-4.25` to `4.25`, including all information-boundary neighborhoods
- 500 replications per theta and path rule
- fixed-20 and fixed-30 randomesque-5 paths
- `N(0,1)` and `N(0,2)` EAP reporting posteriors
- information-equivalent SD boundaries `.25`, `.30`, and `.35`
- posterior classification masses `.80`, `.90`, and `.95`
- 27,000 generated CAT paths and 486,000 candidate-posterior evaluations
- common response paths, deterministic seed, source/plan/bank hashes, and Wilson score bounds for binomial gates

## Result

`0 / 36` candidates passed. Twenty candidates failed only the theta and transformed-score interval-coverage gates. Across all candidates:

- 29 passed both outside-range safety gates;
- 26 passed interior numerical-score availability;
- 27 passed reported-score bias and RMSE; and
- none passed interval calibration at every validated-interior theta cell.

Observed conditional coverage among candidates ranged from `.918` to `.9896`. Because the 8000-scale transform is monotone and equal-tail endpoints are transformed directly, theta and model-score coverage were exactly identical; both independently coded gates failed together.

## Representative near-passes

The fixed-20, `N(0,1)`, information-SD `.25`, posterior-mass `.95` candidate had:

- maximum clearly-outside false numerical reporting `.004`;
- minimum validated-interior numerical availability `.996`;
- maximum reported absolute theta bias `.0707`;
- maximum reported theta RMSE `.1790`; and
- reported interval coverage from `.9220` to `.9779`.

The fixed-30, `N(0,2)`, information-SD `.25`, posterior-mass `.95` candidate had:

- maximum clearly-outside false numerical reporting `.000`;
- minimum validated-interior numerical availability `.988`;
- maximum reported absolute theta bias `.0314`;
- maximum reported theta RMSE `.1547`; and
- reported interval coverage from `.9419` to `.9757`.

These are diagnostic near-passes, not selected candidates. The predeclared rule requires every gate, including Wilson uncertainty, and therefore selects none.

## Interpretation

Posterior range classification can substantially suppress false numerical reporting, but it does not calibrate the numerical interval. Equal-tail Bayesian credible intervals under a fixed prior need not have uniform conditional frequentist coverage at every fixed true theta. Relaxing the frozen coverage rule after seeing these results would invalidate the exploration/confirmation separation.

The range study did not gate exposure, but recorded maximum marginal exposure `.363` for fixed 20 and `.417` for fixed 30. Thus the longer form improves bias/RMSE without solving the previously identified security limitation.

## Next gate

Do not run a nominal confirmation yet. First compare interval constructions on common paths—without changing the range-classification results—including at least a simulation-calibrated interval and a likelihood-based or WLE-compatible interval. Predeclare interval-width, coverage, bias, and reporting-availability criteria; then freeze one complete scoring-and-reporting rule for an independent 5,000-replication confirmation.
