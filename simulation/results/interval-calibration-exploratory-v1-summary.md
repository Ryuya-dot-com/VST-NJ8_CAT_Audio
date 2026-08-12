# Interval-calibration exploratory simulation v1

## Status

Exploratory only. `0 / 10` candidate-method combinations passed every frozen gate. No reporting rule advances to confirmation and no production score-reporting behavior changes.

## Design

- two preselected near-pass contracts: fixed-20 with reporting EAP `N(0,1)` and fixed-30 with reporting EAP `N(0,2)`;
- randomesque-5 selection with `N(0,1)` selection EAP and the same information-SD `.25` reporting range;
- 37 calibration theta cells from `-4.5` to `4.5` by `.25`, with 1,000 paths per candidate and theta;
- 27 independent evaluation theta cells, with 1,000 paths per candidate and theta;
- 74,000 calibration paths plus 54,000 evaluation paths (`128,000` CAT paths total);
- current equal-tail posterior, fixed chi-square likelihood ratio, calibrated likelihood ratio, calibrated Warm weighted likelihood, and central EAP Neyman intervals; and
- separate calibration/evaluation seeds, common random numbers across candidates, common paths across methods within a candidate, source/plan/bank hashes, and 90% Wilson equivalence gates.

The TypeScript posterior, likelihood, Warm objective `log L + 0.5 log I`, and interval-inversion kernel were checked against an independent base-R implementation on four fixed paths before the simulation plan was committed.

## Result

No method passed the predeclared conditional coverage gate at every validated-interior theta. The fixed-20 candidate also exposed conditional bias or width failures for several likelihood/Neyman methods. Range safety and availability generally remained strong.

| Candidate | Method | Failed gates | Coverage range | Max mean theta width |
| --- | --- | --- | ---: | ---: |
| fixed-20 `N(0,1)` | equal-tail EAP | coverage, tail balance | `.9270–.9710` | `.7646` |
| fixed-20 `N(0,1)` | fixed LR | bias, coverage | `.9330–.9714` | `.7993` |
| fixed-20 `N(0,1)` | calibrated LR | bias, coverage, mean width | `.9369–.9660` | `.8402` |
| fixed-20 `N(0,1)` | calibrated Warm | coverage, mean width | `.9300–.9690` | `.8194` |
| fixed-20 `N(0,1)` | central EAP Neyman | bias, coverage, tail balance, mean width | `.9300–.9680` | `.8430` |
| fixed-30 `N(0,2)` | equal-tail EAP | coverage, tail balance | `.9220–.9743` | `.7046` |
| fixed-30 `N(0,2)` | fixed LR | coverage, tail balance | `.9270–.9660` | `.7033` |
| fixed-30 `N(0,2)` | calibrated LR | coverage, tail balance | `.9330–.9605` | `.7295` |
| fixed-30 `N(0,2)` | calibrated Warm | coverage, tail balance | `.9340–.9590` | `.7154` |
| fixed-30 `N(0,2)` | central EAP Neyman | coverage, tail balance | `.9259–.9620` | `.7167` |

All coverage ranges above are observed conditional proportions, not evidence bounds. The frozen gate was stricter: the 90% Wilson interval had to lie fully inside `[.925, .975]` in every validated-interior cell. For example, fixed-30 calibrated Warm coverage at theta `-1.5` was `.93794` over 999 reports, but its Wilson lower bound was `.92416`. At theta `-1`, its lower-tail miss rate was `.040`, but the Wilson upper bound was `.05150`, above the `.05` tail gate.

## Interpretation

Simulation calibration shifted interval behavior but did not establish uniform conditional validity after the numerical-reporting selection rule. Calibration was unconditional over generated paths at each theta, whereas evaluation assessed coverage only among paths whose range classification and interval endpoints allowed a numerical report. That post-generation conditioning can alter coverage. This is evidence against treating a generic calibrated interval as a substitute for validating the complete reporting rule.

Some failures are close to the evidence boundary and could change with a larger run. That is not permission to promote a method: no method passed the frozen exploratory selection rule. Conversely, fixed-20 failures in conditional bias and width show that its limitations are not only Monte Carlo resolution.

The monotone `paper-3pl-v1` transformation preserves every theta interval coverage event exactly, so converting endpoints to the 8000 scale cannot repair failed coverage. Vocabulary widths remain theta-dependent and were therefore recorded without imposing an unjustified constant-width limit.

## Next gate

Do not run the nominal 5,000-replication confirmation. A new exploration must decide in advance whether the inferential target is unconditional coverage for all generated paths or selective conditional coverage among numerically reported paths. If the latter remains the target, calibrate the complete selection-and-interval procedure, not the interval alone, and reserve independent evaluation paths. Any revised equivalence margin, theta grid, interval-width gate, or indifference rule is a new protocol rather than a reinterpretation of this result.
