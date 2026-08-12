export interface SympsonHetterCalibrationUpdate {
  selectionRates: number[];
  administrationParameters: number[];
}

export function updateSympsonHetterParameters(
  selectionCounts: ArrayLike<number>,
  examineeCount: number,
  targetMaximumExposure: number
): SympsonHetterCalibrationUpdate {
  if (!Number.isInteger(examineeCount) || examineeCount < 1) {
    throw new RangeError("Sympson-Hetter calibration requires examinees.");
  }
  if (
    !Number.isFinite(targetMaximumExposure) ||
    targetMaximumExposure <= 0 ||
    targetMaximumExposure > 1
  ) {
    throw new RangeError("Target maximum exposure must be in (0, 1].");
  }
  const counts = Array.from(selectionCounts);
  if (
    counts.length === 0 ||
    counts.some(
      (count) =>
        !Number.isInteger(count) || count < 0 || count > examineeCount
    )
  ) {
    throw new RangeError(
      "Selection counts must be integer event counts between zero and examinee count."
    );
  }
  const selectionRates = counts.map((count) => count / examineeCount);
  const administrationParameters = selectionRates.map((selectionRate) =>
    selectionRate <= targetMaximumExposure
      ? 1
      : targetMaximumExposure / selectionRate
  );
  return { selectionRates, administrationParameters };
}

export function sympsonHetterAccepts(
  administrationParameter: number,
  uniformRandom: number
): boolean {
  if (
    !Number.isFinite(administrationParameter) ||
    administrationParameter < 0 ||
    administrationParameter > 1
  ) {
    throw new RangeError("Administration parameters must be in [0, 1].");
  }
  if (
    !Number.isFinite(uniformRandom) ||
    uniformRandom < 0 ||
    uniformRandom >= 1
  ) {
    throw new RangeError("The exposure draw must be in [0, 1). ");
  }
  return uniformRandom <= administrationParameter;
}
