# Independent base-R reference calculations for the exploratory estimator set.
# No TypeScript implementation or generated output is read by this script.

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
  ifelse(
    probability <= item$Guessing | probability >= 1,
    0,
    (D * item$Dscrimination)^2 * (1 - probability) *
      (probability - item$Guessing)^2 /
      (probability * (1 - item$Guessing)^2)
  )
}

log_likelihood <- function(theta, administered, responses) {
  value <- 0
  for (response_index in seq_along(administered)) {
    item <- bank[administered[[response_index]] + 1, ]
    probability <- probability_3pl(theta, item)
    value <- value + if (responses[[response_index]] == 1) {
      log(probability)
    } else {
      log1p(-probability)
    }
  }
  value
}

test_information <- function(theta, administered) {
  sum(vapply(
    administered,
    function(index) item_information(theta, bank[index + 1, ]),
    numeric(1)
  ))
}

posterior_grid <- function(administered, responses, prior_sd) {
  values <- vapply(
    theta_grid,
    function(theta) {
      log_likelihood(theta, administered, responses) +
        dnorm(theta, mean = 0, sd = prior_sd, log = TRUE)
    },
    numeric(1)
  )
  weights <- exp(values - max(values))
  weights <- weights / sum(weights)
  mean <- sum(weights * theta_grid)
  cumulative <- cumsum(weights)
  c(
    mean = mean,
    sd = sqrt(sum(weights * (theta_grid - mean)^2)),
    lower_95 = theta_grid[[which(cumulative >= 0.025)[[1]]]],
    upper_95 = theta_grid[[which(cumulative >= 0.975)[[1]]]]
  )
}

global_maximum <- function(objective) {
  values <- vapply(theta_grid, objective, numeric(1))
  index <- which.max(values)
  if (index == 1 || index == length(theta_grid)) {
    return(c(theta = theta_grid[[index]], boundary = 1))
  }
  interval <- theta_grid[c(index - 1, index + 1)]
  refined <- optimize(
    objective,
    interval = interval,
    maximum = TRUE,
    tol = 1e-11
  )
  candidates <- c(theta_grid[[index]], refined$maximum)
  candidate_values <- vapply(candidates, objective, numeric(1))
  theta <- candidates[[which.max(candidate_values)]]
  c(theta = theta, boundary = as.numeric(abs(theta) >= 6 - 1e-8))
}

estimate_all <- function(administered, responses) {
  likelihood <- function(theta) log_likelihood(theta, administered, responses)
  eap_1 <- posterior_grid(administered, responses, 1)
  eap_2 <- posterior_grid(administered, responses, 2)
  map_1 <- global_maximum(function(theta) likelihood(theta) + dnorm(theta, log = TRUE))
  map_2 <- global_maximum(
    function(theta) likelihood(theta) + dnorm(theta, sd = 2, log = TRUE)
  )
  mle <- global_maximum(likelihood)
  wle <- global_maximum(function(theta) {
    information <- test_information(theta, administered)
    if (information > 0) likelihood(theta) + 0.5 * log(information) else -Inf
  })
  list(
    eap_normal_0_1 = c(
      theta = eap_1[["mean"]],
      posterior_sd = eap_1[["sd"]],
      lower_95 = eap_1[["lower_95"]],
      upper_95 = eap_1[["upper_95"]]
    ),
    eap_normal_0_2 = c(
      theta = eap_2[["mean"]],
      posterior_sd = eap_2[["sd"]],
      lower_95 = eap_2[["lower_95"]],
      upper_95 = eap_2[["upper_95"]]
    ),
    map_normal_0_1 = map_1,
    map_normal_0_2 = map_2,
    mle_bounded = c(
      mle,
      information_sd = 1 / sqrt(test_information(mle[["theta"]], administered))
    ),
    warm_wle_bounded = c(
      wle,
      information_sd = 1 / sqrt(test_information(wle[["theta"]], administered))
    )
  )
}

scenarios <- list(
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

emit <- function(label, value) {
  cat(label, format(value, digits = 17, scientific = FALSE, trim = TRUE), sep = "\t")
  cat("\n")
}

for (scenario_name in names(scenarios)) {
  scenario <- scenarios[[scenario_name]]
  estimates <- estimate_all(scenario$administered, scenario$responses)
  for (estimator_name in names(estimates)) {
    estimate <- estimates[[estimator_name]]
    for (field in names(estimate)) {
      emit(
        paste(scenario_name, estimator_name, field, sep = "__"),
        estimate[[field]]
      )
    }
  }
}
