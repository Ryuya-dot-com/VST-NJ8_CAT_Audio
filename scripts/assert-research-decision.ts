import assert from "node:assert/strict";

export const RESEARCH_DECISION_COMPARISON_CONTRACT_ID =
  "simulation-research-decision-v1";

export function assertResearchDecisionInvariant<Report>(
  recomputedReport: Report,
  storedReport: Report,
  selectDecision: (report: Report) => unknown,
  label = "research decision"
): void {
  assert.deepEqual(
    selectDecision(recomputedReport),
    selectDecision(storedReport),
    `${label}: recomputation changed a predeclared gate or decision`
  );
}
