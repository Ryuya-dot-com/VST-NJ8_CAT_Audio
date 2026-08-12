# Estimator sensitivity — exploratory v1

Status: **exploratory; no production estimator selected**

Plan: `estimator-sensitivity-exploratory-v1`

Seed: `20260812`

Result SHA-256: `6e9a855afdd246711881ea63ce145f0a2c4e2ca29a88b84d69680db926fa4587`

## Design

The simulation used 15 true-theta conditions from `-3.5` to `3.5`, 500 replications per condition, and two fixed-length EAP-selected randomesque-5 paths (20 and 30 items). This produced 15,000 item/response paths and 90,000 final estimates.

Within each path condition, EAP `N(0,1)`, EAP `N(0,2^2)`, MAP under both priors, bounded MLE, and bounded Warm WLE scored the **same administered indices and responses**. Fixed-20 and fixed-30 used common random-number streams; the longer path extends the corresponding shorter path. The comparison is on theta. No plug-in 8,000-word transform is used in this report.

This analysis was run after inspecting `confirmation-v1` and the bank diagnostic, so it cannot serve as confirmatory evidence.

## Conditional worst cases

| Length | Estimator | Worst absolute bias | Maximum RMSE | Maximum boundary rate | Minimum 95% posterior coverage |
|---:|---|---:|---:|---:|---:|
| 20 | EAP `N(0,1)` | .409 | .481 | .000 | .810 |
| 20 | EAP `N(0,2^2)` | .218 | .475 | .000 | .914 |
| 20 | MAP `N(0,1)` | .500 | .562 | .000 | — |
| 20 | MAP `N(0,2^2)` | .147 | .447 | .000 | — |
| 20 | bounded MLE | .782 | 1.450 | .330 | — |
| 20 | Warm WLE | .132 | .507 | .000 | — |
| 30 | EAP `N(0,1)` | .349 | .424 | .000 | .854 |
| 30 | EAP `N(0,2^2)` | .210 | .458 | .000 | .924 |
| 30 | MAP `N(0,1)` | .431 | .494 | .000 | — |
| 30 | MAP `N(0,2^2)` | .100 | .415 | .000 | — |
| 30 | bounded MLE | .573 | 1.217 | .230 | — |
| 30 | Warm WLE | .095 | .461 | .000 | — |

“—” means that this simulation did not attach a posterior interval to that point estimator; it does not mean perfect or missing-at-random coverage.

## Endpoint detail

At 20 items and true theta `-3.5`:

- EAP `N(0,1)` bias was `.409` (MCSE `.011`), RMSE `.481`, and 95% posterior coverage `.810` (MCSE `.018`).
- EAP `N(0,2^2)` bias was `-.050` (MCSE `.020`), RMSE `.444`, and coverage `.978`.
- Warm WLE bias was `.132` (MCSE `.022`) with RMSE `.507`.
- bounded MLE reached a numerical boundary in `.114` of trials and had RMSE `.962`.

At 20 items and true theta `3.5`:

- EAP `N(0,1)` bias was `-.215` and coverage `.898`.
- EAP `N(0,2^2)` bias was `.218` and coverage `.974`.
- Warm WLE bias was `-.103` with RMSE `.240`.
- bounded MLE reached the upper boundary in `.330` of trials and had RMSE `1.450`.

Thirty items reduced several errors but did not remove the range limitation. Warm WLE still had RMSE `.461` at theta `-3.5`; EAP `N(0,1)` still had bias `.349` and coverage `.854` there.

## Interpretation

1. **The standard-normal prior is materially influential.** Its endpoint shrinkage is not a negligible implementation detail. A wider prior changes the direction and location of bias; it must be justified from the target population, not tuned solely to make endpoint cells pass.
2. **Bounded MLE is not viable for this short CAT.** Boundary rates up to `.330` show that reporting the artificial bound as an ability estimate would be misleading.
3. **Warm WLE is a serious point-estimator candidate, not an automatic winner.** It had the smallest worst absolute bias in these comparisons and no boundary hits, but its low-end RMSE remained above `.46`, and no interval-calibration result has yet been established.
4. **MAP `N(0,2^2)` had the smallest maximum RMSE here**, but this depends on an exploratory prior choice and lacks an evaluated uncertainty interval.
5. **More items alone remain insufficient.** The fixed-30 condition does not overcome the item-bank information deficit identified independently.
6. **Exposure remains unresolved.** Maximum item exposure was `.356` at 20 items and `.381` at 30 items. Randomesque-5 is not direct exposure control.

## Decision

Do not replace the production estimator yet. Retain Warm WLE, MAP with a defensible prior, and EAP with explicit prior sensitivity as candidates. Reject bounded MLE as a standalone operational estimator for the current short bank. Next, add direct exposure control and an explicit measurable-range policy, then cross the surviving estimator candidates with stopping rules in a newly frozen simulation.
