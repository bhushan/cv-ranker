import type { Candidate, Role } from "./domain";
import { rankCandidates } from "./rankings/ranking";

export const ROLE_NAME: Record<Role, string> = {
  PM: "Product Manager",
  SPM: "Senior Product Manager",
};
export const scoreFor = (c: Candidate, role: Role) =>
  c.evaluations.find((e) => e.role === role)?.overall_score;
export const formatScore = (n: number | undefined) =>
  n === undefined ? "–" : n.toFixed(1);
export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

/** Completely evaluated candidates for one role, best first, with the same tie-breaks as the server. */
export function rankedFor(candidates: readonly Candidate[], role: Role) {
  return rankCandidates(
    candidates
      .filter((c) => c.status === "COMPLETE" && c.evaluations.length === 2)
      .flatMap((c) => {
        const score = scoreFor(c, role);
        return score === undefined
          ? []
          : [
              {
                id: c.id,
                created_at: c.created_at,
                overall_score: score,
                candidate: c,
              },
            ];
      }),
  ).map((r) => ({
    candidate: r.candidate,
    score: r.overall_score,
    rank: r.rank,
  }));
}
export function rankIn(
  candidates: readonly Candidate[],
  id: string,
  role: Role,
) {
  return (
    rankedFor(candidates, role).find((r) => r.candidate.id === id)?.rank ?? null
  );
}
export function shortlistIds(candidates: readonly Candidate[]) {
  return new Set(
    (["PM", "SPM"] as Role[]).flatMap((role) =>
      rankedFor(candidates, role)
        .slice(0, 5)
        .map((r) => r.candidate.id),
    ),
  );
}
/** The pending draft to review after `currentId`, in list order, wrapping; null when none remain. */
export function nextPendingDraft(
  candidates: readonly Candidate[],
  currentId: string,
) {
  const pending = candidates.flatMap((c) =>
    c.email?.status === "PENDING_REVIEW" ? [c.email.id] : [],
  );
  const others = pending.filter((id) => id !== currentId);
  if (!others.length) return null;
  const at = pending.indexOf(currentId);
  return at < 0 ? others[0] : (pending[(at + 1) % pending.length] ?? others[0]);
}
export function emailStatusLabel(status?: string) {
  switch (status) {
    case "PENDING_REVIEW":
      return "Needs review";
    case "SENDING":
      return "Sending";
    case "SENT":
      return "Sent";
    case "REJECTED":
      return "Rejected";
    default:
      return "No draft";
  }
}
export function emailTone(status?: string) {
  return status === "SENT"
    ? "go"
    : status === "PENDING_REVIEW"
      ? "hold"
      : status === "SENDING"
        ? "info"
        : "neutral";
}
/** Sample candidates use reserved example domains that can never receive email. */
export const isSyntheticAddress = (email: string) =>
  /@(?:example\.(?:com|org|net)|[^@]+\.invalid)$/i.test(email);
export function candidateStage(c: Candidate, shortlisted: boolean) {
  if (c.status === "FAILED") return { label: "Stopped", tone: "hold" };
  if (c.status !== "COMPLETE") return { label: "Processing", tone: "info" };
  return shortlisted
    ? { label: "Shortlisted", tone: "signal" }
    : { label: "Not shortlisted", tone: "neutral" };
}
