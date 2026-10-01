import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  getUserById: vi.fn(),
  generateLink: vi.fn(),
  rpc: vi.fn(),
  deliver: vi.fn(),
}));
vi.mock("../lib/supabase/client", () => ({
  getSupabaseAdmin: () => ({ auth: { admin: mocks }, rpc: mocks.rpc }),
}));
vi.mock("../lib/resend/client", () => ({ deliverEmail: mocks.deliver }));
import { requestFounderLink } from "../lib/auth-link";
beforeEach(() => {
  vi.stubEnv("FOUNDER_USER_ID", "founder-id");
  vi.stubEnv("RESEND_API_KEY", "test-key");
  vi.stubEnv("RESEND_FROM_EMAIL", "sender@example.com");
  mocks.getUserById.mockResolvedValue({
    data: { user: { id: "founder-id", email: "founder@example.com" } },
    error: null,
  });
  mocks.rpc.mockResolvedValue({ data: "reservation-id", error: null });
  mocks.generateLink.mockResolvedValue({
    data: { properties: { hashed_token: "hash" } },
    error: null,
  });
});
afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});
it("does not generate or send links for another email", async () => {
  await requestFounderLink("other@example.com", "https://kargo.example.com");
  expect(mocks.rpc).not.toHaveBeenCalled();
  expect(mocks.generateLink).not.toHaveBeenCalled();
  expect(mocks.deliver).not.toHaveBeenCalled();
});
it("reserves allowance before sending a founder link", async () => {
  await requestFounderLink("founder@example.com", "https://kargo.example.com");
  expect(mocks.rpc).toHaveBeenCalledWith("reserve_auth_link");
  expect(mocks.deliver).toHaveBeenCalledWith(
    expect.objectContaining({
      to: "founder@example.com",
      body: expect.stringContaining(
        "/auth/confirm?token_hash=hash&type=magiclink",
      ),
    }),
  );
});
it.each(["AUTH_LINK_RATE_LIMITED", "RESEND_QUOTA_EXCEEDED"])(
  "does not send when %s",
  async (message) => {
    mocks.rpc.mockResolvedValue({ error: { message } });
    await expect(
      requestFounderLink("founder@example.com", "https://kargo.example.com"),
    ).rejects.toThrow();
    expect(mocks.deliver).not.toHaveBeenCalled();
  },
);
