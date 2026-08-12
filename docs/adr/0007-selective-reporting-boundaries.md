# ADR 0007: Information support is not the operational numerical-reporting range

- Status: Accepted; selective interval candidate rejected
- Date: 2026-08-12
- Scope: `selective-reporting-exploratory-v1`

## Decision

Reject the fixed-30 selective EAP Neyman reporting rule and do not start confirmation. Separate the full-bank information-support range from the operational range in which a CAT point estimate and numerical interval may be reported.

The information-support endpoints remain useful diagnostic limits. They are not claims that a 30-item selected CAT estimate is conditionally unbiased or sufficiently precise throughout that entire interval.

## Evidence

The precommitted experiment used 303,179 calibration paths and 320,000 independent evaluation paths. Every supported theta cell had at least 2,500 numerically selected evaluation paths. Calibration-quantile uncertainty was controlled prospectively with exact binomial Bonferroni order statistics, and the estimated acceptance limits were widened by conservative monotone envelopes.

The interval raised endpoint coverage from approximately `.535/.472` for the equal-tail diagnostic to `.979/.987`. Nevertheless it failed the frozen upper coverage, width, fallback, point-bias, and RMSE gates. At the exact support endpoints, selected-path EAP bias was `+.340` and `-.439` theta.

## Why the point bias is structural

At a boundary, the numerical-reporting event retains paths whose posterior classification and EAP fall inside the support interval. Paths whose estimates fluctuate outward are withheld; paths fluctuating inward remain. Conditioning on that event shifts the selected estimator distribution toward the interior. No wider interval changes the EAP value or removes this conditional selection bias.

This is not an argument to delete the selection rule. The rule successfully suppresses false numerical reporting far outside the support range. It is an argument to stop equating the outer information limit with an operational point-reporting limit.

## Consequences

- Preserve `exploratory-not-for-score-reporting` on all outputs.
- Do not expose a newly calibrated interval in either application.
- Do not relax point-bias or RMSE gates at the endpoints after seeing the result.
- Keep FCR secondary; its aggregate value can conceal endpoint failures.
- Continue to transform interval endpoints to the 8000 scale only after a theta interval is validated.
- Keep direct exposure control separate; maximum marginal exposure was `.5176` here.

## Next experiment

Predeclare several guard-band candidates inside the fixed information-support range. For each candidate, define an operational numerical core, withhold point estimates outside it, and evaluate the complete selection/point/interval rule on every `.25` theta condition plus exact operational endpoints and neighboring exterior conditions. The candidate order and all bias, RMSE, coverage, width, availability, and safety gates must be fixed before execution.
