import { beforeEach, afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock("../lib/auth", () => ({
  authClient: async () => ({ auth: mocks }),
  requireSameOrigin: vi.fn(),
}));
import { POST } from "../app/api/auth/login/route";
beforeEach(() => {
  vi.stubEnv("FOUNDER_USER_ID", "founder-id");
  mocks.signInWithPassword.mockResolvedValue({
    data: { user: { id: "founder-id" } },
    error: null,
  });
});
afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});
const request = (email: string) =>
  new Request("https://kargo.example.com/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "temporary-password" }),
  });
it("normalizes accidentally padded founder email without altering password", async () => {
  const response = await POST(request(" Founder@Example.com "));
  expect(response.status).toBe(200);
  expect(mocks.signInWithPassword).toHaveBeenCalledWith({
    email: "founder@example.com",
    password: "temporary-password",
  });
});
it("shows an actionable message for rejected credentials", async () => {
  mocks.signInWithPassword.mockResolvedValue({
    data: { user: null },
    error: { code: "invalid_credentials" },
  });
  const response = await POST(request("founder@example.com"));
  expect(response.status).toBe(401);
  const { message } = (await response.json()).error;
  expect(message).toContain("Email or password");
  expect(message).not.toContain("sign-in link");
  expect(mocks.signOut).toHaveBeenCalled();
});
it("does not allow another authenticated account", async () => {
  mocks.signInWithPassword.mockResolvedValue({
    data: { user: { id: "another-id" } },
    error: null,
  });
  expect((await POST(request("other@example.com"))).status).toBe(401);
  expect(mocks.signOut).toHaveBeenCalled();
});
