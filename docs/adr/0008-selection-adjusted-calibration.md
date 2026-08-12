# ADR 0008: Direct rejection calibration is infeasible for adjusted boundary estimates

- Status: Accepted; evaluation blocked pending importance-sampling validation
- Date: 2026-08-12
- Scope: `selection-adjusted-feasibility-v1`

## Decision

Do not start the selection-adjusted point-estimator evaluation with direct rejection calibration. Preserve the three selection cores and their `.50`-expanded estimation domains. Investigate a separately frozen defensive mixture importance sampler; do not raise the direct-generation cap or move estimation endpoints after seeing the pilot.

## Evidence

The planning pilot generated 10,000 common CAT paths at each of 13 exact boundary and neighboring theta cells. For each candidate and calibration-domain cell, a one-sided 90% Wilson lower bound projected the selected count at the predeclared 250,000-path cap.

Eight candidate-by-theta cells failed the requirement of at least 2,500 selected calibration paths. At the three lower estimation-domain endpoints, only 2, 2, and 3 of 10,000 paths were selected for guard bands `.50`, `.75`, and `1.00`. Their conservative projected counts at the cap were only 21, 21, and 36. All three upper estimation-domain endpoints also failed, with projected counts 2,224, 1,641, and 705.

## Why the estimation domain is not narrowed

Constraining the adjusted estimate to the selection core makes endpoint errors one-sided and renders a symmetric mean-bias goal structurally impossible except for a degenerate estimator. The `.50` guard region is therefore part of the estimand and error contract, not disposable computational slack.

## Importance-sampling requirements

A candidate sampler must:

- use a prospective defensive mixture whose proposal includes every target distribution with positive mass;
- compute response-path likelihood ratios for the complete adaptive CAT history;
- justify cancellation of theta-independent randomized item-selection factors;
- report normalized and unnormalized estimates, effective sample size, maximum normalized weight, and tail diagnostics;
- agree with direct simulation at preregistered overlap theta cells within simultaneous uncertainty bounds; and
- keep all pilot and calibration seeds distinct from final evaluation seeds.

Failure of these checks ends this route. Importance sampling may solve a rare-event computation problem; it cannot repair model misspecification, unidentified item-parameter uncertainty, or an invalid selection estimand.
