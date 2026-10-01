import type { Evaluation, Rubric } from "@/lib/domain";
/** A score drawn as its rubric: segment width is a criterion's weight, fill is its score out of 10. */
export function Strip({
  rubric,
  evaluation,
  size = "md",
}: {
  rubric?: Rubric;
  evaluation?: Evaluation;
  size?: "sm" | "md" | "lg";
}) {
  if (!rubric) return null;
  return (
    <span className={"strip " + size} aria-hidden="true">
      {rubric.criteria.map((c) => {
        const result = evaluation?.criteria.find(
          (x) => x.criterion_id === c.id,
        );
        return (
          <span key={c.id} style={{ flexGrow: c.weight }} title={c.name}>
            <i style={{ width: `${(result?.score ?? 0) * 10}%` }} />
          </span>
        );
      })}
    </span>
  );
}
