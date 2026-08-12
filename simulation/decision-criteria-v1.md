# CAT simulation decision criteria v1

Status: locked for `confirmation-v1`; provisional engineering gates, not a validity claim

## Separation of exploration and confirmation

`pilot-v1` and `focused-v1` are exploratory. They may identify candidates and
failure modes, but they cannot establish a production stopping rule.
`confirmation-v1.json` was written after inspecting the exploratory results and
must not be changed after its first execution. Any change creates a new plan ID,
seed, and result artifact.

Passing these gates only admits a rule to later sensitivity analysis and
post-hoc CAT validation. It does not establish that the paper-model score is a
literal known-word count or that written calibration applies to the audio mode.

## Confirmation design

- Correctly specified paper 3PL response model, `D = 1.702`.
- EAP estimation with the normal prior and theta grid in `paper-3pl-v1`.
- True theta from -3.5 to 3.5 in increments of 0.5.
- 5,000 replications per theta condition and rule.
- Equal weight for theta conditions in overall summaries. This is a design
  distribution, not a claim about the operational examinee population.
- Common response and selection random-number streams across candidate rules.
- At least two items from levels 7 or 8 before precision stopping.
- Nominal 95% equal-tail posterior intervals.

At 5,000 replications, the binomial Monte Carlo standard error at 95% coverage
is about 0.0031. The report records Monte Carlo standard errors rather than
hiding simulation noise.

## Provisional gates

A candidate advances only if all conditions below hold.

1. Numerical integrity
   - No estimator, posterior-normalization, or item-bank-exhaustion failures.
   - High-level content-constraint violation rate equals zero.
2. Conditional theta performance
   - For `-2.5 <= theta <= 2.5`, absolute bias is at most 0.10.
   - For the four edge conditions, absolute bias is at most 0.15.
   - RMSE is at most 0.30 at every theta condition.
3. Interval calibration
   - At every theta condition, empirical 95% coverage is between 0.925 and
     0.975 after allowing one two-sided Monte Carlo margin
     (`estimate +/- 1.96 * MCSE`) to intersect that interval.
4. Respondent burden
   - Overall mean length is at most 25 items and overall 90th percentile is at
     most 30 items.
   - Maximum-length stopping is at most 5% overall and at most 10% in every
     theta condition.
5. Bank security and use
   - Maximum item exposure is at most 0.25 under the equal-theta design.
   - Unused-item rate is at most 0.10.

The 0.25 exposure gate is an engineering protection target, not a universal
psychometric constant. It must be reconsidered with the operational theta
distribution, test volume, item-reuse policy, and breach model.

## Deliberately outside this confirmation run

- Empirical examinee theta distributions.
- Item-parameter uncertainty, parameter drift, DIF, local dependence, and
  response-model misspecification.
- MAP and WLE estimators, vocabulary-interval-width stopping, full frequency
  level and part-of-speech blueprints, and formal shadow testing.
- Written full-bank post-hoc CAT validation and all audio-mode calibration.

These omissions prevent any production release decision even if a candidate
passes every provisional gate.
