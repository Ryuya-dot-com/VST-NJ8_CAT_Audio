# Exact enumeration of Monte Carlo decision power for the proposed selective
# reporting evaluation. This does not simulate CAT responses and does not
# estimate psychometric performance.

z <- qnorm(0.95) # one-sided 5%, equivalently a two-sided 90% Wilson interval
minimum_coverage <- 0.925
maximum_coverage <- 0.975
maximum_tail_miss <- 0.05

wilson_bounds <- function(successes, trials) {
  rate <- successes / trials
  z2 <- z^2
  denominator <- 1 + z2 / trials
  center <- (rate + z2 / (2 * trials)) / denominator
  half <- z / denominator *
    sqrt(rate * (1 - rate) / trials + z2 / (4 * trials^2))
  c(lower = center - half, upper = center + half)
}

decision_power <- function(reported_trials, supported_theta_cells = 14) {
  counts <- 0:reported_trials
  coverage_pass <- counts[vapply(
    counts,
    function(count) {
      bounds <- wilson_bounds(count, reported_trials)
      bounds[["lower"]] >= minimum_coverage &&
        bounds[["upper"]] <= maximum_coverage
    },
    logical(1)
  )]
  tail_pass <- counts[vapply(
    counts,
    function(count) {
      wilson_bounds(count, reported_trials)[["upper"]] <= maximum_tail_miss
    },
    logical(1)
  )]

  maximum_tail_count <- max(tail_pass)
  total_miss_counts <-
    max(0, reported_trials - max(coverage_pass)):
      min(
        reported_trials,
        reported_trials - min(coverage_pass),
        2 * maximum_tail_count
      )
  cell_probability <- sum(vapply(
    total_miss_counts,
    function(total_misses) {
      # Under ideal balanced 95% coverage, total misses are Binomial(n, .05)
      # and lower misses conditional on total misses are Binomial(m, .5).
      lower_minimum <- max(0, total_misses - maximum_tail_count)
      lower_maximum <- min(maximum_tail_count, total_misses)
      conditional_probability <- if (lower_minimum > lower_maximum) {
        0
      } else {
        pbinom(lower_maximum, total_misses, 0.5) -
          if (lower_minimum == 0) {
            0
          } else {
            pbinom(lower_minimum - 1, total_misses, 0.5)
          }
      }
      dbinom(total_misses, reported_trials, 0.05) * conditional_probability
    },
    numeric(1)
  ))

  data.frame(
    reported_trials = reported_trials,
    minimum_cover_count = min(coverage_pass),
    maximum_cover_count = max(coverage_pass),
    maximum_each_tail_count = maximum_tail_count,
    ideal_cell_pass_probability = cell_probability,
    ideal_all_cell_pass_probability =
      cell_probability^supported_theta_cells
  )
}

result <- do.call(
  rbind,
  lapply(c(500, 1000, 1500, 2000, 2500, 5000), decision_power)
)
options(digits = 10)
write.table(
  result,
  row.names = FALSE,
  quote = FALSE,
  sep = "\t"
)
