# Independent base-R reference for information-support-exploratory-v1.
# This intentionally does not call the TypeScript implementation.

args <- commandArgs(trailingOnly = TRUE)
bank_path <- if (length(args) >= 1) args[[1]] else "public/jacet_parameters.csv"
bank <- read.csv(bank_path, check.names = FALSE, fileEncoding = "UTF-8-BOM")

D <- 1.702
sd_thresholds <- c(0.25, 0.30, 0.35)

probability_3pl <- function(theta) {
  bank$Guessing +
    (1 - bank$Guessing) *
      plogis(D * bank$Dscrimination * (theta - bank$Difficulty))
}

bank_information <- function(theta) {
  probability <- probability_3pl(theta)
  sum(
    (D * bank$Dscrimination)^2 * (1 - probability) *
      (probability - bank$Guessing)^2 /
      (probability * (1 - bank$Guessing)^2)
  )
}

level_means <- aggregate(
  cbind(Dscrimination, Difficulty, Guessing) ~ Level,
  data = bank,
  FUN = mean
)

paper_vocabulary <- function(theta) {
  probability <- level_means$Guessing +
    (1 - level_means$Guessing) *
      plogis(D * level_means$Dscrimination * (theta - level_means$Difficulty))
  1000 * sum(probability)
}

connected_boundaries <- function(sd_threshold) {
  information_threshold <- 1 / sd_threshold^2
  difference <- function(theta) bank_information(theta) - information_threshold
  if (difference(0) < 0) stop("Anchor theta is outside support.")

  grid <- seq(-6, 6, by = 0.01)
  values <- vapply(grid, difference, numeric(1))
  anchor_index <- which(grid == 0)
  lower_outside <- max(which(seq_along(grid) < anchor_index & values < 0))
  upper_outside <- min(which(seq_along(grid) > anchor_index & values < 0))
  lower <- uniroot(
    difference,
    c(grid[[lower_outside]], grid[[lower_outside + 1]]),
    tol = 1e-14
  )$root
  upper <- uniroot(
    difference,
    c(grid[[upper_outside - 1]], grid[[upper_outside]]),
    tol = 1e-14
  )$root
  c(
    lower_theta = lower,
    upper_theta = upper,
    information_threshold = information_threshold,
    lower_information = bank_information(lower),
    upper_information = bank_information(upper),
    lower_paper_vocabulary = paper_vocabulary(lower),
    upper_paper_vocabulary = paper_vocabulary(upper)
  )
}

emit <- function(sd_threshold, metric, value) {
  cat(
    format(sd_threshold, digits = 17, scientific = FALSE, trim = TRUE),
    metric,
    format(value, digits = 17, scientific = FALSE, trim = TRUE),
    sep = "\t"
  )
  cat("\n")
}

for (sd_threshold in sd_thresholds) {
  result <- connected_boundaries(sd_threshold)
  for (metric in names(result)) emit(sd_threshold, metric, result[[metric]])
}
