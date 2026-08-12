# Selective numerical-reporting exploratory simulation v1

## Status

Exploratory only. The selective EAP Neyman procedure failed six frozen gates. It does not advance to confirmation and no production score-reporting behavior changes.

## Design

- fixed-30, randomesque-5 CAT with `N(0,1)` selection EAP and `N(0,2)` reporting EAP;
- information-SD `.25` support range `[-2.7578183981, 3.3090556474]`;
- interval-independent numerical selection: posterior `within-range` probability at least `.95` and EAP inside the support range;
- 27 calibration theta cells, each with 2,500 selected paths;
- exact binomial/Bonferroni simultaneous acceptance ranks 40 and 2,461, followed by conservative monotone envelopes;
- 303,179 generated calibration paths and 67,500 selected calibration paths;
- 320,000 fixed evaluation paths, including 100,000 at each exact support endpoint;
- at least 2,500 selected evaluation paths at each of 14 supported-theta cells; and
- an equal-tail EAP interval retained as a nonselectable diagnostic baseline.

## Result

The selectable procedure passed range safety, opposite-extreme classification, interior availability, selected-sample evidence, and tail balance. It failed:

1. empty-inversion fallback;
2. selected-path theta bias;
3. selected-path theta RMSE;
4. selected-path conditional coverage;
5. conditional mean width; and
6. conditional 90th-percentile width.

Observed selectable-procedure extrema were:

- maximum clearly-outside numerical-selection rate `.0002`;
- minimum validated-interior selection rate `.9877`;
- minimum selected paths over the 14 supported-theta cells `2,935`;
- maximum empty-inversion fallback rate `.0181`;
- maximum absolute selected-path theta bias `.4389`;
- maximum selected-path theta RMSE `.4466`;
- conditional coverage `.9660–.9866`;
- maximum conditional mean width `.8456`;
- maximum conditional 90th-percentile width `1.0100`; and
- aggregate false coverage-statement rate over supported-theta cells `.0258`.

The baseline equal-tail interval had aggregate FCR `.1295` and endpoint coverage `.5349` at the lower limit and `.4720` at the upper limit. The selective interval materially corrected this boundary undercoverage, reaching `.9789` and `.9866`, but became too conservative under the frozen upper coverage and width gates.

## Structural boundary finding

At the exact support endpoints, the data-dependent reporting event selected only `2.94%` and `5.37%` of evaluation paths. Conditional on selection, reporting EAP bias was `+.3402` at the lower endpoint and `-.4389` at the upper endpoint. This inward bias is structural: requiring an estimate and its posterior mass to lie inside a boundary preferentially selects endpoint paths whose estimates move toward the interior.

Therefore the information-support range is not an operational range in which an approximately unbiased numerical point estimate can be claimed after selection. Interval calibration alone cannot repair the conditional point-estimation bias. The monotone 8000-scale transform also cannot repair theta coverage; it preserves coverage events exactly.

## Engineering interpretation

The experiment prevents three tempting but invalid conclusions:

- good full-bank information does not establish reportable CAT score range;
- a low aggregate FCR does not establish per-theta conditional coverage; and
- a selection-aware interval does not make the selected point estimator unbiased.

The recorded maximum marginal item exposure was `.5176`, so this interval work also does not solve the separate security limitation.

## Next gate

Do not run confirmation. Predeclare a narrower operational numerical-reporting range strictly inside the information-support range, with explicit guard bands. Evaluate candidate guard bands on a dense theta grid, including every `.25` cell and both operational boundaries. The directional/determinate classifications may still be returned outside that operational core, but a point estimate and 8000-scale interval must be withheld. Any new range is an exploratory reporting policy, not a reinterpretation of the full-bank information boundary.
