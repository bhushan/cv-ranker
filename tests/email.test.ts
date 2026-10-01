import { describe, it, expect } from "vitest";
import { assertCanSend, createEmailDraft } from "../lib/emails/drafts";
describe("founder email approval", () => {
  it("allows pending review only with explicit approval", () => {
    expect(() => assertCanSend("PENDING_REVIEW", true)).not.toThrow();
    expect(() => assertCanSend("PENDING_REVIEW", false)).toThrow();
  });
  it("prevents sent or in-flight duplicate sends", () => {
    for (const status of ["SENT", "SENDING", "REJECTED"])
      expect(() => assertCanSend(status, true)).toThrow();
  });
  it("generates professional stored drafts without evaluation details", () => {
    const draft = createEmailDraft("Alex Example", true);
    expect(draft.status).toBe("PENDING_REVIEW");
    expect(draft.body).not.toMatch(/score|rank|rubric|AI reasoning/i);
  });
});
