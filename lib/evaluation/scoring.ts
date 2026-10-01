import { z } from "zod";
import { AppError } from "../errors";
import type { Rubric, CriterionResult } from "../types";
export const evaluationSchema = z
  .object({
    criteria: z.array(
      z
        .object({
          criterion_id: z.string(),
          score: z.number().min(0).max(10),
          evidence: z.string().max(3000),
          reasoning: z.string().min(1).max(3000),
          confidence: z.number().min(0).max(1),
        })
        .strict(),
    ),
  })
  .strict();
const normalize = (text: string) =>
  text.replace(/\s+/g, " ").trim().toLowerCase();
export function calculateScore(
  rubric: Rubric,
  criteria: CriterionResult[],
  cvContent: string,
): number {
  const invalid = () => {
    throw new AppError(
      "GEMINI_INVALID_RESPONSE",
      "AI returned unsupported scoring evidence. Please retry.",
      502,
    );
  };
  if (
    !rubric.criteria.length ||
    new Set(rubric.criteria.map((c) => c.id)).size !== rubric.criteria.length ||
    Math.abs(rubric.criteria.reduce((s, c) => s + c.weight, 0) - 100) >
      0.000001 ||
    rubric.criteria.some(
      (c) => !c.id || !Number.isFinite(c.weight) || c.weight < 0,
    )
  )
    invalid();
  if (
    !evaluationSchema.safeParse({ criteria }).success ||
    criteria.length !== rubric.criteria.length ||
    new Set(criteria.map((c) => c.criterion_id)).size !== criteria.length
  )
    invalid();
  const content = normalize(cvContent);
  return rubric.criteria.reduce((total, criterion) => {
    const result = criteria.find((c) => c.criterion_id === criterion.id);
    if (!result) return invalid();
    const evidence = normalize(result.evidence);
    if (
      (!evidence || evidence === "evidence unavailable") &&
      result.score !== 0
    )
      invalid();
    if (
      evidence &&
      evidence !== "evidence unavailable" &&
      !content.includes(evidence)
    )
      invalid();
    return total + (result.score / 10) * criterion.weight;
  }, 0);
}
