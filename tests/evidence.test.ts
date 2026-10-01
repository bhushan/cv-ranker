import { expect, it } from "vitest";
import { evidenceFound, withVerifiedEvidence } from "../lib/evaluation/scoring";
import type { Rubric } from "../lib/types";
const rubric = {
  role: "PM",
  version: 1,
  source: "",
  criteria: ["a", "b", "c"].map((id) => ({
    id,
    name: id,
    weight: 100 / 3,
    description: "",
    evaluation_guidance: "",
  })),
} as Rubric;
const cv = `EXPERIENCE
Treblle — API Observability Platform
Senior Software Engineer | July 2023 – April 2026
• Designed and built full-stack features for a platform processing 1B+
requests/month .
• Built merchant onboarding workflows serving millions of global merchants ; reduced onboarding friction.
• Module Lead → Senior Developer, said “ship it” often.`;
it("matches quotes that differ only in typography", () => {
  for (const quote of [
    "processing 1B+ requests/month.",
    "Senior Software Engineer | July 2023 - April 2026",
    "Treblle - API Observability Platform",
    "Designed and built full-stack features",
    "serving millions of global merchants; reduced onboarding friction.",
    'said "ship it" often',
  ])
    expect(evidenceFound(quote, cv), quote).toBe(true);
});
it("matches excerpts joined by an ellipsis only when every fragment is present in order", () => {
  expect(
    evidenceFound(
      "Designed and built full-stack features … serving millions of global merchants",
      cv,
    ),
  ).toBe(true);
  expect(
    evidenceFound(
      "serving millions of global merchants ... Designed and built full-stack features",
      cv,
    ),
  ).toBe(false);
  expect(
    evidenceFound(
      "Designed and built full-stack features ... led a logistics team",
      cv,
    ),
  ).toBe(false);
});
it("still rejects reworded or invented evidence", () => {
  expect(
    evidenceFound("Built merchant onboarding for freight carriers", cv),
  ).toBe(false);
  expect(evidenceFound("processing 2B+ requests/month", cv)).toBe(false);
});
it("scores an unverifiable quote zero instead of failing the whole evaluation", () => {
  const [kept, dropped, missing] = withVerifiedEvidence(
    rubric,
    [
      {
        criterion_id: "a",
        score: 7,
        evidence: "Designed and built full-stack features",
        reasoning: "Clear.",
        confidence: 0.8,
      },
      {
        criterion_id: "b",
        score: 6,
        evidence: "Ran customs clearance for 40 ports",
        reasoning: "Strong.",
        confidence: 0.7,
      },
      {
        criterion_id: "a",
        score: 9,
        evidence: "duplicate",
        reasoning: "x",
        confidence: 1,
      },
      {
        criterion_id: "zzz",
        score: 9,
        evidence: "unknown id",
        reasoning: "x",
        confidence: 1,
      },
    ],
    cv,
  );
  expect(kept).toMatchObject({
    score: 7,
    evidence: "Designed and built full-stack features",
  });
  expect(dropped).toMatchObject({
    score: 0,
    confidence: 0,
    evidence: "Evidence unavailable",
  });
  expect(dropped.reasoning).toMatch(/could not be found in the CV/);
  expect(missing).toMatchObject({
    criterion_id: "c",
    score: 0,
    evidence: "Evidence unavailable",
  });
});
