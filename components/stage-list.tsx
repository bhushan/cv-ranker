import { Check } from "lucide-react";
export const STAGES = [
  { id: "PARSE", label: "Read the CV and remove contact details" },
  { id: "PM", label: "Score against the PM rubric" },
  { id: "SPM", label: "Score against the SPM rubric" },
  { id: "FINALIZE", label: "Update rankings and draft the email" },
] as const;
/** Ordered processing steps; `current` is the index in progress, STAGES.length when done. */
export function StageList({
  current,
  running,
  failed,
}: {
  current: number;
  running: boolean;
  failed: boolean;
}) {
  return (
    <ol className="stages">
      {STAGES.map((s, i) => {
        const state =
          i < current
            ? "done"
            : i === current
              ? failed
                ? "failed"
                : running
                  ? "active"
                  : "next"
              : "todo";
        return (
          <li key={s.id} data-state={state}>
            <span className="stage-dot">
              {state === "done" ? <Check size={12} strokeWidth={3} /> : i + 1}
            </span>
            {s.label}
            {state === "failed" && <span className="sr-only"> (stopped)</span>}
          </li>
        );
      })}
    </ol>
  );
}
