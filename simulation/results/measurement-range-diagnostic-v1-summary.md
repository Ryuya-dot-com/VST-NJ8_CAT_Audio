# Measurement-range diagnostic v1

## Status

Exploratory only. This diagnostic does not authorize numerical production reporting or change the application UI.

## Primary result

With full-bank information-equivalent SD at most `.30`, the connected support component containing theta zero is:

```text
theta [-2.9031647494, 3.4279929070]
paper-3pl-v1 technical model score [919.80, 7993.32]
```

Both crossings reproduce an independent base-R implementation to `1e-9`. The endpoints use exact root finding rather than the nearest theta-grid cell.

## Interpretation

This is a property of the complete 160-item bank under its fitted 3PL model. It is not a demonstrated operating range for a 20-item CAT. The full-bank quantity `1 / sqrt(I)` is not CAT RMSE, and the 8000-scale endpoints are technical transforms rather than counts of words known.

The `.25` sensitivity range is `[-2.757818, 3.309056]`; the `.35` range is `[-3.053285, 3.523955]`. This sensitivity is one reason not to choose a reporting boundary from information alone.

## Decision

The posterior four-class contract (`below-range`, `within-range`, `above-range`, `indeterminate`) is implemented but marked `exploratory-not-for-score-reporting`. A class requires `.95` posterior mass. The next gate is a pre-specified common-path simulation of its classification errors and conditional score performance, followed by an independent frozen confirmation run.
