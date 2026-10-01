import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const state = vi.hoisted(() => ({
  email: "real@candidate.dev",
  updates: [] as {
    values: Record<string, unknown>;
    filters: [string, unknown][];
  }[],
  rpc: vi.fn(),
  deliver: vi.fn(),
}));
function table(name: string) {
  if (name === "candidate_identity") {
    const q = {
      select: () => q,
      eq: () => q,
      single: async () => ({ data: { email: state.email }, error: null }),
    };
    return q;
  }
  return {
    select: () => ({
      eq: () => ({
        single: async () => ({ data: { candidate_id: "c1" }, error: null }),
      }),
    }),
    update(values: Record<string, unknown>) {
      const entry = { values, filters: [] as [string, unknown][] };
      state.updates.push(entry);
      const q = {
        eq(column: string, value: unknown) {
          entry.filters.push([column, value]);
          return q;
        },
        then: (resolve: (v: unknown) => void) => resolve({ error: null }),
      };
      return q;
    },
  };
}
vi.mock("../lib/supabase/client", () => ({
  getSupabaseAdmin: () => ({ rpc: state.rpc, from: table }),
}));
vi.mock("../lib/resend/client", async (load) => ({
  ...(await load<typeof import("../lib/resend/client")>()),
  deliverEmail: state.deliver,
}));
import { sendEmail } from "../lib/emails/service";
import { AppError } from "../lib/errors";
const DRAFT = "11111111-1111-4111-8111-111111111111";
beforeEach(() => {
  vi.stubEnv("RESEND_API_KEY", "test");
  vi.stubEnv("RESEND_FROM_EMAIL", "Kargo <hiring@kargo.dev>");
  state.email = "real@candidate.dev";
  state.updates = [];
  state.rpc.mockResolvedValue({
    data: {
      id: DRAFT,
      candidate_id: "c1",
      subject: "Hi",
      body: "Body",
      status: "SENDING",
    },
    error: null,
  });
});
afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});
it("refuses a synthetic recipient before claiming, so the draft is never locked", async () => {
  state.email = "candidate1@example.com";
  await expect(
    sendEmail(DRAFT, true, "2026-10-01T00:00:00Z"),
  ).rejects.toMatchObject({
    code: "EMAIL_RECIPIENT_INVALID",
  });
  expect(state.rpc).not.toHaveBeenCalled();
  expect(state.deliver).not.toHaveBeenCalled();
});
it("returns the draft to review when the provider definitely rejected the send", async () => {
  state.deliver.mockRejectedValue(
    new AppError(
      "RESEND_REJECTED",
      "Resend rejected this email: domain not verified.",
      502,
    ),
  );
  await expect(
    sendEmail(DRAFT, true, "2026-10-01T00:00:00Z"),
  ).rejects.toMatchObject({
    code: "RESEND_REJECTED",
  });
  const release = state.updates.at(-1)!;
  expect(release.values).toMatchObject({
    status: "PENDING_REVIEW",
    error: "RESEND_REJECTED",
  });
  expect(release.filters).toContainEqual(["status", "SENDING"]);
});
it("keeps the send locked when delivery is ambiguous", async () => {
  state.deliver.mockRejectedValue(new Error("network timeout"));
  await expect(
    sendEmail(DRAFT, true, "2026-10-01T00:00:00Z"),
  ).rejects.toMatchObject({
    code: "RESEND_FAILED",
  });
  expect(state.updates.every((u) => u.values.status === undefined)).toBe(true);
});
