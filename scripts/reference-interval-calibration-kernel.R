# Independent base-R reference calculations for interval inversion.
# This script deliberately reads only the item bank, never TypeScript output.

args <- commandArgs(trailingOnly = TRUE)
bank_path <- if (length(args) >= 1) args[[1]] else "public/jacet_parameters.csv"
bank <- read.csv(bank_path, check.names = FALSE, fileEncoding = "UTF-8-BOM")

D <- 1.702
theta_grid <- seq(-6, 6, by = 0.01)
chi_square_cutoff <- 3.841458820694124

probability_3pl <- function(theta, item) {
  item$Guessing +
    (1 - item$Guessing) *
      plogis(D * item$Dscrimination * (theta - item$Difficulty))
}

item_information <- function(theta, item) {
  probability <- probability_3pl(theta, item)
  ifelse(
    probability <= item$Guessing | probability >= 1,
    0,
    (D * item$Dscrimination)^2 * (1 - probability) *
      (probability - item$Guessing)^2 /
      (probability * (1 - item$Guessing)^2)
  )
}

objective_interval <- function(values, cutoff) {
  maximum_index <- which.max(values)
  accepted <- 2 * (max(values) - values) <= cutoff
  indices <- which(accepted)
  connected <- length(indices) > 0 &&
    identical(indices, seq.int(min(indices), max(indices)))
  valid <- connected &&
    min(indices) <= maximum_index && maximum_index <= max(indices)
  c(
    lower = if (valid) theta_grid[[min(indices)]] else NaN,
    upper = if (valid) theta_grid[[max(indices)]] else NaN,
    valid = as.numeric(valid)
  )
}

weighted_quantile <- function(values, weights, probability) {
  values[[which(cumsum(weights) >= probability)[[1]]]]
}

summarize_kernel <- function(administered, responses, prior_sd) {
  log_likelihood <- rep(0, length(theta_grid))
  information <- rep(0, length(theta_grid))
  for (response_index in seq_along(administered)) {
    item <- bank[administered[[response_index]] + 1, ]
    probability <- probability_3pl(theta_grid, item)
    log_likelihood <- log_likelihood + if (responses[[response_index]] == 1) {
      log(probability)
    } else {
      log1p(-probability)
    }
    information <- information + item_information(theta_grid, item)
  }
  log_weighted_likelihood <-
    log_likelihood + 0.5 * log(pmax(information, 1e-300))
  log_posterior <-
    log_likelihood - 0.5 * (theta_grid / prior_sd)^2
  posterior <- exp(log_posterior - max(log_posterior))
  posterior <- posterior / sum(posterior)
  eap <- sum(posterior * theta_grid)
  likelihood_ratio_interval <-
    objective_interval(log_likelihood, chi_square_cutoff)
  warm_diagnostic <-
    objective_interval(log_weighted_likelihood, chi_square_cutoff)
  zero_index <- which(theta_grid == 0)[[1]]
  c(
    prior_standard_deviation = prior_sd,
    eap = eap,
    posterior_standard_deviation =
      sqrt(sum(posterior * (theta_grid - eap)^2)),
    posterior_lower_95 = weighted_quantile(theta_grid, posterior, 0.025),
    posterior_upper_95 = weighted_quantile(theta_grid, posterior, 0.975),
    likelihood_maximum_theta_on_grid = theta_grid[[which.max(log_likelihood)]],
    warm_maximum_theta_on_grid =
      theta_grid[[which.max(log_weighted_likelihood)]],
    likelihood_ratio_lower_95 = likelihood_ratio_interval[["lower"]],
    likelihood_ratio_upper_95 = likelihood_ratio_interval[["upper"]],
    likelihood_ratio_valid = likelihood_ratio_interval[["valid"]],
    warm_diagnostic_lower_95 = warm_diagnostic[["lower"]],
    warm_diagnostic_upper_95 = warm_diagnostic[["upper"]],
    warm_diagnostic_valid = warm_diagnostic[["valid"]],
    likelihood_ratio_at_theta_zero =
      2 * (max(log_likelihood) - log_likelihood[[zero_index]]),
    warm_likelihood_ratio_at_theta_zero =
      2 * (max(log_weighted_likelihood) -
        log_weighted_likelihood[[zero_index]])
  )
}

scenarios <- list(
  mixed_eight_n01 = list(
    administered = c(0, 20, 40, 60, 80, 100, 120, 140),
    responses = c(1, 0, 1, 1, 0, 1, 0, 1),
    prior_sd = 1
  ),
  mixed_twenty_n02 = list(
    administered = seq(0, 152, by = 8),
    responses = c(1, 1, 0, 1, 0, 0, 1, 1, 0, 1, 0, 1, 1, 0, 0, 1, 0, 1, 0, 1),
    prior_sd = 2
  ),
  all_correct_eight_n01 = list(
    administered = c(0, 20, 40, 60, 80, 100, 120, 140),
    responses = rep(1, 8),
    prior_sd = 1
  ),
  all_incorrect_eight_n02 = list(
    administered = c(0, 20, 40, 60, 80, 100, 120, 140),
    responses = rep(0, 8),
    prior_sd = 2
  )
)

emit <- function(label, value) {
  cat(label, format(value, digits = 17, scientific = FALSE, trim = TRUE), sep = "\t")
  cat("\n")
}

for (scenario_name in names(scenarios)) {
  scenario <- scenarios[[scenario_name]]
  result <- summarize_kernel(
    scenario$administered,
    scenario$responses,
    scenario$prior_sd
  )
  for (field in names(result)) {
    emit(paste(scenario_name, field, sep = "__"), result[[field]])
  }
}
