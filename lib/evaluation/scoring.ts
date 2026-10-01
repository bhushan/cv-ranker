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
/** Compare text ignoring typography only: quotes, dashes, bullets and spacing around punctuation. */
const normalize = (text: string) =>
  text
    .normalize("NFKC")
    .replace(/[\u2018\u2019\u201A\u2032]/g, "'")
    .replace(/[\u201C\u201D\u201E\u2033]/g, '"')
    .replace(/[\u2010-\u2015\u2212]/g, "-")
    .replace(/[\u2022\u2023\u2043\u25AA\u25CF\u00B7]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/ ([.,;:!?)])/g, "$1")
    .replace(/\( /g, "(")
    .trim()
    .toLowerCase();
const UNAVAILABLE = "evidence unavailable";
const tidy = (fragment: string) =>
  normalize(fragment)
    .replace(/^["'(\[\s]+|["')\]\s]+$/g, "")
    .replace(/[.;,:]+$/, "")
    .trim();
/**
 * True when the quote is in the CV verbatim, ignoring typography, wrapping quotes and a trailing
 * full stop. A citation of several CV lines (quoted separately, or joined by "…", ";", "|",
 * bullets or line breaks) passes only if every line is in the CV.
 */
export function evidenceFound(evidence: string, cvContent: string) {
  const content = normalize(cvContent);
  const whole = tidy(evidence);
  if (!whole) return false;
  if (content.includes(whole)) return true;
  const straight = normalize(evidence);
  const quoted = [...straight.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  const fragments = (
    quoted.length ? quoted : evidence.split(/\.{3}|\u2026|\n|;|\||\u2022/)
  )
    .map(tidy)
    .filter((f) => f.length >= 4);
  return (
    fragments.length > 0 &&
    fragments.some((f) => f.length >= 15) &&
    fragments.every((f) => content.includes(f))
  );
}
const unverified = (criterion_id: string, reasoning: string) => ({
  criterion_id,
  score: 0,
  confidence: 0,
  evidence: "Evidence unavailable",
  reasoning,
});
/**
 * One result per rubric criterion, in rubric order. A quote that is not in the CV, or a criterion the
 * AI skipped, becomes an honest zero, so nothing unverified is stored or shown.
 */
export function withVerifiedEvidence(
  rubric: Rubric,
  criteria: CriterionResult[],
  cvContent: string,
): CriterionResult[] {
  return rubric.criteria.map(({ id }) => {
    const c = criteria.find((x) => x.criterion_id === id);
    if (!c)
      return unverified(
        id,
        "The AI did not assess this criterion, so it was not scored. Check it in the interview.",
      );
    const evidence = normalize(c.evidence);
    if (
      !evidence ||
      evidence === UNAVAILABLE ||
      evidenceFound(c.evidence, cvContent)
    )
      return c;
    return unverified(
      id,
      "The AI cited evidence that could not be found in the CV, so this criterion was not scored. Check the CV directly in the interview.",
    );
  });
}
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
  return rubric.criteria.reduce((total, criterion) => {
    const result = criteria.find((c) => c.criterion_id === criterion.id);
    if (!result) return invalid();
    const evidence = normalize(result.evidence);
    if ((!evidence || evidence === UNAVAILABLE) && result.score !== 0)
      invalid();
    if (
      evidence &&
      evidence !== UNAVAILABLE &&
      !evidenceFound(result.evidence, cvContent)
    )
      invalid();
    return total + (result.score / 10) * criterion.weight;
  }, 0);
}
