# Defensive importance-sampling validation v1

## Status

Method validation failed eight preregistered gates. The sampler is not approved for selection-adjusted calibration, the point-estimator evaluation has not started, and no production reporting behavior changes.

## Design

- twelve target/proposal experiments covering lower and upper endpoints and direct-simulation overlap cells for all three guard-band candidates;
- 20,000 paths per defensive mixture, with target-mixture probability `.20` and a single auxiliary theta at the adjacent selection-core endpoint;
- six independent direct-simulation comparisons of 20,000 paths each;
- 240,000 mixture CAT plus 120,000 direct CAT;
- complete 30-response adaptive-path likelihood ratios; randomized item-selection factors cancel because the same history-dependent policy is used under target and proposal;
- analytical raw-weight bound `1/.20 = 5`; and
- simultaneous empirical-Bernstein intervals across the 12 mean-weight identities, 12 weighted selection probabilities, and six direct probabilities.

## What passed

- all twelve observed maximum raw weights were below `5`;
- all twelve simultaneous mean-weight intervals contained the identity value `1`;
- all six overlap-cell weighted probabilities agreed with independent direct simulation within the sum of simultaneous half-widths;
- all six overlap comparisons met the frozen combined-half-width limit `.025`; and
- all three upper endpoint experiments passed selected-ESS, normalized-weight concentration, and projected calibration-ESS gates.

## What failed

The lower endpoint proposal remained unstable after conditioning on selection:

| candidate | selected ESS / 20,000 | maximum selected normalized weight | projected ESS / 250,000 |
|---|---:|---:|---:|
| guard `.50` | 74.59 | .1085 | 932.33 |
| guard `.75` | 7.35 | .3443 | 91.88 |
| guard `1.00` | 238.61 | .0250 | 2,982.58 |

All three failed the endpoint ESS threshold `1,000` and maximum normalized-weight threshold `.01`. The `.50` and `.75` candidates also failed the projected calibration ESS threshold `2,500`; the `1.00` candidate passed only the projection threshold.

The weighted lower-endpoint selection-probability estimates were approximately `.000290`, `.000074`, and `.000450`. Their simultaneous empirical-Bernstein half-widths were about `.00424`, so the finite-sample intervals correctly expose that these rare-event estimates are not precise despite bounded raw weights.

## Interpretation

The adaptive response-path likelihood-ratio implementation is supported by weight-identity and overlap checks. The proposal distribution is not. Moving only the generating theta to the selection-core endpoint does not adequately cover target-theta paths after the rare reporting selection; a few weighted selected paths dominate the lower-tail conditional distribution.

Increasing the run length would not repair the frozen 20,000-path endpoint ESS gate, and smoothing the observed weights would change the estimator after failure. Both are rejected as post-hoc rescues.

## Next gate

Do not implement or evaluate the conditional-median or conditional-likelihood point estimator with this proposal. A further route, if pursued, requires a prespecified rare-event change of measure targeted to the selection event itself (for example, response-level exponential tilting or sequential Monte Carlo), with exact path-density accounting and the same direct-overlap, bounded-weight/concentration, and finite-sample uncertainty checks. Otherwise, abandon conditional numerical reporting near the lower boundary and retain only categorical range statements.
