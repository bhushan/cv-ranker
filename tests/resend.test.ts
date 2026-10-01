import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { deliverEmail } from "../lib/resend/client";
const input = { id: "d1", to: "a@b.dev", subject: "s", body: "b" };
beforeEach(() => {
  vi.stubEnv("RESEND_API_KEY", "test");
  vi.stubEnv("RESEND_FROM_EMAIL", "Kargo <hiring@kargo.dev>");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
const respond = (status: number, body: unknown) =>
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status })),
  );
it("reports a definite provider rejection with the provider's reason", async () => {
  respond(403, { message: "The kargo.dev domain is not verified." });
  await expect(deliverEmail(input)).rejects.toMatchObject({
    code: "RESEND_REJECTED",
    message: expect.stringContaining("domain is not verified"),
  });
});
it("treats provider server errors as ambiguous", async () => {
  respond(500, { message: "internal" });
  await expect(deliverEmail(input)).rejects.toMatchObject({
    code: "RESEND_FAILED",
  });
});
