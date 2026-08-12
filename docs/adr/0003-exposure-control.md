# ADR 0003: Direct exposure control is simulation-only

- Status: Accepted for exploratory simulation; rejected for production at this stage
- Date: 2026-08-13
- Scope: fixed-length 20-item CAT paths using `paper-3pl-v1`

## Decision

Implement unconditional Sympson–Hetter (SH) exposure calibration as a reproducible simulation component. Do not describe randomesque selection as direct exposure control, and do not promote the SH parameters generated here to the production browser application.

For each item `i`, distinguish selection `S_i` from administration `A_i`. At calibration cycle `t`, estimate the selection probability from simulated examinees and update

```text
k_i^(t+1) = P(A_i | S_i)
            = min(1, r_max / P_hat_t(S_i)).
```

When an item is selected, draw `U ~ Uniform[0,1)`. Administer the item if `U <= k_i`; otherwise block it for that examinee and consider the next eligible item. Calibration and evaluation use separate deterministic random streams. Item parameters are versioned with the item-bank hash, simulation plan hash, source hashes, and seed.

The initial exploratory target is the existing engineering gate `r_max = .25` under the equal-theta design distribution. It is not claimed to be a universal security standard or an operational population distribution.

## Content constraints

The exploratory engine supports minimum counts for mutually exclusive frequency-level bands. It preserves future feasibility by restricting selection to bands with deficits when the number of remaining positions equals the total outstanding minimum.

Three specifications are compared:

1. at least two Level 7–8 items;
2. at least two items from each of Levels 1–2, 3–6, and 7–8; and
3. at least one item from every individual frequency level.

This sequential mechanism guarantees these disjoint minimum constraints in the simulated designs. It is not a general shadow-test optimizer and cannot be extended by assumption to interacting level, part-of-speech, format, enemy-item, or time constraints. Such simultaneous specifications require a formally feasible automated test-assembly model. The part-of-speech distribution remains diagnostic only until content experts define defensible targets.

## Results and interpretation

After eight calibration cycles, independent evaluation produced unconditional maximum exposures from `.256` to `.260`, compared with `.356` for the earlier randomesque-5 fixed-20 path. No design met the exact `.25` engineering gate. More importantly, maximum exposure conditional on true theta was `.998` to `1.000`.

This is not a contradiction: unconditional SH controls exposure averaged over the calibration distribution. An item used almost exclusively in one of 15 equally weighted theta cells can have low marginal exposure while being administered to nearly everyone in that cell. Therefore unconditional control must not be presented as conditional item-security protection.

The three-band blueprint was the least damaging constrained candidate. The every-level minimum worsened endpoint bias and RMSE and is rejected as a mechanical content rule. No blueprint is substantively approved without content-expert review.

## Engineering and security limits

The current public, client-side CSV contains the complete item bank. SH can balance administrations, but it cannot make publicly downloadable items confidential. Operational item security would additionally require server-side item delivery, removal of answer keys from the client, access control, test-overlap monitoring, bank rotation, and incident procedures.

SH parameters must be recalibrated whenever the bank, item-selection rule, stopping rule, blueprint, estimator used for selection, or operational ability distribution changes. The stored parameters are evidence for this exact exploratory plan only.

## Primary evidence

- Sympson, J. B., & Hetter, R. D. (1985). *Controlling item-exposure rates in computerized adaptive testing*.
- Stocking, M. L. (1993). *Controlling item exposure rates in a realistic adaptive testing paradigm*. ETS Research Report. https://www.ets.org/research/policy_research_reports/publications/report/1993/hxkn.html
- Stocking, M. L., & Lewis, C. (1998). *Controlling item exposure conditional on ability in computerized adaptive testing*. https://doi.org/10.3102/10769986023001057
- van der Linden, W. J. (2003). *Some alternatives to Sympson–Hetter item-exposure control in computerized adaptive testing*. https://doi.org/10.3102/10769986028003249
- van der Linden, W. J. (2010). *Constrained adaptive testing with shadow tests*. https://doi.org/10.1007/978-0-387-85461-8_2

## Next gate

The next exposure experiment must:

1. use a conditional-on-estimated-theta exposure method or explicitly stratified calibration;
2. compare `.25` with a lower calibration target to account for Monte Carlo and operational overshoot;
3. retain the three-band candidate and drop the every-level rule;
4. evaluate item exposure and test overlap both marginally and by theta region;
5. preserve estimator accuracy, interval calibration, and content feasibility; and
6. remain exploratory until an operational population and security model are specified.
