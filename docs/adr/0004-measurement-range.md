# ADR 0004: Separate item-bank information support from score-reporting range

- Status: Accepted as an exploratory diagnostic; rejected for production reporting until simulation confirmation
- Date: 2026-08-12
- Scope: `paper-3pl-v1` and the current 160-item bank

## Decision

Define an **item-bank information-support range** and keep it distinct from an **operational score-reporting range**.

For a provisional information-equivalent standard-deviation threshold `s = .30`, define the support set by

```text
I_bank(theta) = sum_i I_i(theta) >= 1 / s^2 = 11.111111...
```

and take only the connected component containing `theta = 0`. Exact crossings are solved by bracketed bisection and independently reproduced with base R `uniroot`; they are not rounded grid endpoints.

For the current bank, the component is:

```text
-2.9031647494 <= theta <= 3.4279929070
```

The corresponding `paper-3pl-v1` technical model-score values are approximately `919.80` and `7993.32`. These are monotone-transform diagnostics, not validated vocabulary-size cut scores and not claims about words truly known. In particular, the upper transform is already very close to its 8000 asymptote and therefore visually compresses large theta differences.

The software may classify an EAP posterior as `below-range`, `within-range`, `above-range`, or `indeterminate`. A class requires at least `.95` posterior mass in the corresponding region; otherwise the result is indeterminate. Boundary points belong to the within-range region.

Every classifier result is explicitly marked `exploratory-not-for-score-reporting`. No production UI or scoring behavior changes in this ADR.

## Why full-bank information is not enough

`1 / sqrt(I_bank(theta))` is a local, model-based information-equivalent standard deviation if every bank item were used. It is an upper-bound diagnostic for the available bank, not the observed RMSE of a 20- or 30-item adaptive path. It does not include selection error, stopping, prior shrinkage, estimator bias, item-parameter uncertainty, dependence, model misfit, or population shift.

The existing confirmation simulation already demonstrates the distinction. The current fixed-20 CAT has endpoint bias and interval-coverage failures even where the full bank clears the `.30` information threshold. Therefore the information-support component cannot be promoted directly to a numerical reporting range.

## Threshold sensitivity

The independent reference gives:

| Information-equivalent SD | Lower theta | Upper theta | Lower model score | Upper model score |
|---:|---:|---:|---:|---:|
| .25 | -2.757818 | 3.309056 | 961.71 | 7989.63 |
| .30 | -2.903165 | 3.427993 | 919.80 | 7993.32 |
| .35 | -3.053285 | 3.523955 | 893.08 | 7995.32 |

The `.30` threshold is a predeclared exploratory reference, not a threshold selected to make current results pass. The operational threshold must be chosen using an exploratory simulation and then frozen before an independent confirmation run.

## Required operational validation

Before a numerical score may be reported, the next simulation must:

1. use common response paths for competing estimators, lengths, and range thresholds;
2. densely sample theta around both proposed boundaries as well as the interior and more extreme regions;
3. report the complete four-class confusion matrix conditional on true theta;
4. report wrong-direction classification, indeterminate rate, numerical-report rate, bias, RMSE, and interval coverage with Monte Carlo uncertainty;
5. evaluate prior and posterior-mass sensitivity without choosing the winner on confirmation data;
6. repeat the selected rule in a frozen independent-seed confirmation; and
7. retain a non-numeric result whenever the classification is outside-range or indeterminate.

Model-misspecification, local dependence, parameter uncertainty, subgroup invariance, and the audio modality remain separate external-validity gates. Passing a generating-model simulation alone will not establish them.

## Primary evidence

- Morris, S. B., Bass, M., & Neapolitan, R. E. (2020). *Stopping rules for computer adaptive testing when item banks have nonuniform information*. Psychological Test and Assessment Modeling, 62(2), 329–344. https://pmc.ncbi.nlm.nih.gov/articles/PMC7518406/
- Educational Testing Service. (2025). *ETS Standards for Quality and Fairness*. Standards 6.2–6.3 require adaptive-test reliability evidence and conditional standard errors across the score range. https://www.tr.ets.org/pdfs/about/standards-quality-fairness.pdf
- Bruce, B., Fries, J. F., Ambrosini, D., Lingala, B., Gandek, B., Rose, M., & Ware, J. E. (2014). Better assessment of physical function: item improvement is neglected but essential. *Arthritis Research & Therapy, 16*, R191. https://pmc.ncbi.nlm.nih.gov/articles/PMC3978724/

## Consequence

The immediate engineering priority is no longer a more elaborate exposure-control method. It is to establish where the bank and CAT can support defensible score reporting, and to withhold false precision outside that validated region. Expanding the bank with informative extreme items is the substantive remedy if the required reporting range is wider.
