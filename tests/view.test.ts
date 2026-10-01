import { expect, it } from "vitest";
import { getDemoData } from "../lib/demo";
import {
  candidateStage,
  isSyntheticAddress,
  nextPendingDraft,
  rankIn,
  rankedFor,
  shortlistIds,
} from "../lib/view";
const { candidates } = getDemoData();
it("ranks completed candidates per role with stable ties", () => {
  const pm = rankedFor(candidates, "PM");
  expect(pm).toHaveLength(12);
  expect(pm.every((c, i) => !i || pm[i - 1].score >= c.score)).toBe(true);
  expect(rankIn(candidates, pm[0].candidate.id, "PM")).toBe(1);
  expect(rankIn(candidates, "missing", "PM")).toBeNull();
});
it("shortlists the union of both top fives", () => {
  const ids = shortlistIds(candidates);
  const pmTop = rankedFor(candidates, "PM")
    .slice(0, 5)
    .map((r) => r.candidate.id);
  const spmTop = rankedFor(candidates, "SPM")
    .slice(0, 5)
    .map((r) => r.candidate.id);
  expect([...ids].sort()).toEqual([...new Set([...pmTop, ...spmTop])].sort());
});
it("moves to the next pending draft after the current one, wrapping around", () => {
  const pending = candidates.filter(
    (c) => c.email?.status === "PENDING_REVIEW",
  );
  const second = pending[1].email!.id;
  expect(nextPendingDraft(candidates, pending[0].email!.id)).toBe(second);
  expect(nextPendingDraft(candidates, pending.at(-1)!.email!.id)).toBe(
    pending[0].email!.id,
  );
  const one = candidates.map((c, i) =>
    i === 0 ? c : { ...c, email: c.email && { ...c.email, status: "SENT" } },
  );
  expect(nextPendingDraft(one, one[0].email!.id)).toBeNull();
});
it("recognises sample addresses that can never receive email", () => {
  expect(isSyntheticAddress("candidate1@example.com")).toBe(true);
  expect(isSyntheticAddress("a@test.invalid")).toBe(true);
  expect(isSyntheticAddress("ana@example.company.com")).toBe(false);
  expect(isSyntheticAddress("ana@kargo.dev")).toBe(false);
});
it("labels a candidate whose processing stopped differently from one still running", () => {
  const c = candidates[0];
  expect(candidateStage({ ...c, status: "FAILED" }, true)).toEqual({
    label: "Stopped",
    tone: "hold",
  });
  expect(candidateStage({ ...c, status: "PROCESSING" }, false)).toEqual({
    label: "Processing",
    tone: "info",
  });
  expect(candidateStage(c, true)).toEqual({
    label: "Shortlisted",
    tone: "signal",
  });
  expect(candidateStage(c, false)).toEqual({
    label: "Not shortlisted",
    tone: "neutral",
  });
});
