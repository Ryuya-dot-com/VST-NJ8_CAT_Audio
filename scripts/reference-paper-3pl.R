# Independent base-R reference calculations for paper-3pl-v1.
# This script is intentionally separate from the TypeScript implementation.

args <- commandArgs(trailingOnly = TRUE)
bank_path <- if (length(args) >= 1) args[[1]] else "public/jacet_parameters.csv"
bank <- read.csv(bank_path, check.names = FALSE, fileEncoding = "UTF-8-BOM")

D <- 1.702
theta_grid <- seq(-6, 6, by = 0.01)

probability_3pl <- function(theta, item) {
  item$Guessing +
    (1 - item$Guessing) *
      plogis(D * item$Dscrimination * (theta - item$Difficulty))
}

item_information <- function(theta, item) {
  probability <- probability_3pl(theta, item)
  incorrect_probability <- 1 - probability
  (D * item$Dscrimination)^2 * incorrect_probability *
    (probability - item$Guessing)^2 /
    (probability * (1 - item$Guessing)^2)
}

estimate_posterior <- function(administered_zero_based, responses) {
  log_posterior <- dnorm(theta_grid, log = TRUE)
  if (length(administered_zero_based) > 0) {
    for (response_index in seq_along(administered_zero_based)) {
      item <- bank[administered_zero_based[[response_index]] + 1, ]
      probability <- probability_3pl(theta_grid, item)
      log_posterior <- log_posterior + if (responses[[response_index]] == 1) {
        log(probability)
      } else {
        log1p(-probability)
      }
    }
  }
  weights <- exp(log_posterior - max(log_posterior))
  weights <- weights / sum(weights)
  theta <- sum(weights * theta_grid)
  list(
    theta = theta,
    standard_deviation = sqrt(sum(weights * (theta_grid - theta)^2)),
    weights = weights
  )
}

level_means <- data.frame(
  level = 1:8,
  item_count = vapply(1:8, function(level) sum(bank$Level == level), integer(1)),
  discrimination = vapply(
    1:8,
    function(level) mean(bank$Dscrimination[bank$Level == level]),
    numeric(1)
  ),
  difficulty = vapply(
    1:8,
    function(level) mean(bank$Difficulty[bank$Level == level]),
    numeric(1)
  ),
  guessing = vapply(
    1:8,
    function(level) mean(bank$Guessing[bank$Level == level]),
    numeric(1)
  )
)

paper_vocabulary <- function(theta) {
  probabilities <- level_means$guessing +
    (1 - level_means$guessing) *
      plogis(
        D * level_means$discrimination *
          (theta - level_means$difficulty)
      )
  1000 * sum(probabilities)
}

deguessed_vocabulary <- function(theta) {
  50 * sum(plogis(D * bank$Dscrimination * (theta - bank$Difficulty)))
}

weighted_quantile <- function(values, weights, probability) {
  values[[which(cumsum(weights) >= probability)[[1]]]]
}

vocabulary_summary <- function(posterior) {
  values <- vapply(theta_grid, paper_vocabulary, numeric(1))
  posterior_mean <- sum(posterior$weights * values)
  list(
    posterior_mean = posterior_mean,
    posterior_standard_deviation = sqrt(
      sum(posterior$weights * (values - posterior_mean)^2)
    ),
    credible_interval_lower = weighted_quantile(values, posterior$weights, 0.025),
    credible_interval_upper = weighted_quantile(values, posterior$weights, 0.975),
    plug_in_at_theta_mean = paper_vocabulary(posterior$theta)
  )
}

select_next_item <- function(theta, administered_zero_based, need_high) {
  candidates <- setdiff(0:(nrow(bank) - 1), administered_zero_based)
  if (need_high) {
    high_candidates <- candidates[bank$Level[candidates + 1] >= 7]
    if (length(high_candidates) > 0) candidates <- high_candidates
  }
  information <- vapply(
    candidates,
    function(index) item_information(theta, bank[index + 1, ]),
    numeric(1)
  )
  candidates[[which.max(information)]]
}

emit <- function(label, value) {
  cat(label, format(value, digits = 17, scientific = FALSE, trim = TRUE), sep = "\t")
  cat("\n")
}

for (level in 1:8) {
  row <- level_means[level, ]
  emit(sprintf("level_%d_discrimination", level), row$discrimination)
  emit(sprintf("level_%d_difficulty", level), row$difficulty)
  emit(sprintf("level_%d_guessing", level), row$guessing)
}

emit("paper_lower_asymptote", 1000 * sum(level_means$guessing))
level_four <- level_means[4, ]
emit(
  "paper_level_4_probability_theta_0",
  level_four$guessing +
    (1 - level_four$guessing) *
      plogis(D * level_four$discrimination * (0 - level_four$difficulty))
)

for (theta in -3:3) {
  emit(sprintf("paper_vocabulary_theta_%d", theta), paper_vocabulary(theta))
  emit(sprintf("deguessed_vocabulary_theta_%d", theta), deguessed_vocabulary(theta))
}

item_zero <- bank[1, ]
emit("item_0_probability_theta_0", probability_3pl(0, item_zero))
emit("item_0_information_theta_0", item_information(0, item_zero))

scenarios <- list(
  prior_only = list(
    administered = integer(0),
    responses = integer(0)
  ),
  mixed_eight = list(
    administered = c(0, 20, 40, 60, 80, 100, 120, 140),
    responses = c(1, 0, 1, 1, 0, 1, 0, 1)
  ),
  all_correct_eight = list(
    administered = c(0, 20, 40, 60, 80, 100, 120, 140),
    responses = rep(1, 8)
  ),
  all_incorrect_eight = list(
    administered = c(0, 20, 40, 60, 80, 100, 120, 140),
    responses = rep(0, 8)
  ),
  mixed_twenty = list(
    administered = seq(0, 152, by = 8),
    responses = c(1, 1, 0, 1, 0, 0, 1, 1, 0, 1, 0, 1, 1, 0, 0, 1, 0, 1, 0, 1)
  )
)

for (scenario_name in names(scenarios)) {
  scenario <- scenarios[[scenario_name]]
  posterior <- estimate_posterior(scenario$administered, scenario$responses)
  summary <- vocabulary_summary(posterior)
  emit(sprintf("%s_theta", scenario_name), posterior$theta)
  emit(
    sprintf("%s_theta_standard_deviation", scenario_name),
    posterior$standard_deviation
  )
  for (field in names(summary)) {
    emit(sprintf("%s_%s", scenario_name, field), summary[[field]])
  }
}

emit("selection_theta_0_all", select_next_item(0, integer(0), FALSE))
emit("selection_theta_0_high", select_next_item(0, integer(0), TRUE))
emit("selection_theta_minus_2_used_0_1_2", select_next_item(-2, c(0, 1, 2), FALSE))
emit("selection_theta_2_high_used_140_141", select_next_item(2, c(140, 141), TRUE))
