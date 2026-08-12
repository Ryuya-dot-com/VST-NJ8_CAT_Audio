# Independent base-R reference for bank-diagnostic-v1.
# This intentionally does not call the TypeScript implementation.

args <- commandArgs(trailingOnly = TRUE)
bank_path <- if (length(args) >= 1) args[[1]] else "public/jacet_parameters.csv"
bank <- read.csv(bank_path, check.names = FALSE, fileEncoding = "UTF-8-BOM")

D <- 1.702
probability_3pl <- function(theta) {
  bank$Guessing +
    (1 - bank$Guessing) *
      plogis(D * bank$Dscrimination * (theta - bank$Difficulty))
}

item_information <- function(theta) {
  probability <- probability_3pl(theta)
  (D * bank$Dscrimination)^2 * (1 - probability) *
    (probability - bank$Guessing)^2 /
    (probability * (1 - bank$Guessing)^2)
}

oracle_indices <- function(information, test_length, high_floor = 7, min_high = 2) {
  ranked <- order(-information, seq_along(information))
  selected <- ranked[seq_len(test_length)]
  high_count <- sum(bank$Level[selected] >= high_floor)
  if (high_count >= min_high) return(selected)

  selected_flag <- seq_along(information) %in% selected
  replacements <- ranked[!selected_flag[ranked] & bank$Level[ranked] >= high_floor]
  replaceable <- rev(which(bank$Level[selected] < high_floor))
  while (high_count < min_high) {
    selected[replaceable[[1]]] <- replacements[[1]]
    replaceable <- replaceable[-1]
    replacements <- replacements[-1]
    high_count <- high_count + 1
  }
  selected
}

emit <- function(theta, metric, value) {
  cat(
    format(theta, digits = 17, scientific = FALSE, trim = TRUE),
    metric,
    format(value, digits = 17, scientific = FALSE, trim = TRUE),
    sep = "\t"
  )
  cat("\n")
}

for (theta in c(-3.5, 0, 2, 3.5)) {
  information <- item_information(theta)
  total <- sum(information)
  shares <- information / total
  ranked <- order(-information, seq_along(information))
  emit(theta, "full_bank_information", total)
  emit(theta, "full_bank_information_equivalent_sd", 1 / sqrt(total))
  emit(theta, "effective_item_count", 1 / sum(shares^2))
  emit(theta, "top_item_zero_based", ranked[[1]] - 1)
  for (test_length in c(20, 30, 40, 160)) {
    selected <- oracle_indices(information, test_length)
    oracle_information <- sum(information[selected])
    emit(theta, sprintf("oracle_%d_information", test_length), oracle_information)
    emit(theta, sprintf("oracle_%d_information_equivalent_sd", test_length),
         1 / sqrt(oracle_information))
    emit(theta, sprintf("oracle_%d_high_count", test_length),
         sum(bank$Level[selected] >= 7))
  }
}

emit(0, "overall_discrimination_maximum", max(bank$Dscrimination))
emit(0, "overall_difficulty_minimum", min(bank$Difficulty))
emit(0, "overall_difficulty_maximum", max(bank$Difficulty))
