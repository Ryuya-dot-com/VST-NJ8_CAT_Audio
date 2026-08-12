import assert from "node:assert/strict";
import test from "node:test";

import {
  assertResearchDecisionInvariant,
  RESEARCH_DECISION_COMPARISON_CONTRACT_ID,
} from "../scripts/assert-research-decision.ts";

interface ExampleReport {
  diagnosticMean: number;
  decision: {
    candidateId: string;
    passesAllGates: boolean;
    failedGates: string[];
  };
}

function selectDecision(report: ExampleReport): ExampleReport["decision"] {
  return report.decision;
}

test("decision comparison ignores non-decision diagnostic drift", () => {
  assert.equal(
    RESEARCH_DECISION_COMPARISON_CONTRACT_ID,
    "simulation-research-decision-v1"
  );
  const stored: ExampleReport = {
    diagnosticMean: 1.25,
    decision: {
      candidateId: "candidate-a",
      passesAllGates: false,
      failedGates: ["coverage"],
    },
  };
  const recomputed = { ...stored, diagnosticMean: 1.2500000001 };

  assert.doesNotThrow(() =>
    assertResearchDecisionInvariant(recomputed, stored, selectDecision)
  );
});

test("decision comparison keeps identifiers and gate outcomes exact", () => {
  const stored: ExampleReport = {
    diagnosticMean: 1.25,
    decision: {
      candidateId: "candidate-a",
      passesAllGates: false,
      failedGates: ["coverage"],
    },
  };

  assert.throws(() =>
    assertResearchDecisionInvariant(
      {
        ...stored,
        decision: { ...stored.decision, passesAllGates: true },
      },
      stored,
      selectDecision
    )
  );
  assert.throws(() =>
    assertResearchDecisionInvariant(
      {
        ...stored,
        decision: { ...stored.decision, candidateId: "candidate-b" },
      },
      stored,
      selectDecision
    )
  );
});
