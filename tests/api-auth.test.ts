import { afterEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  requireFounder: vi.fn(),
  getDashboard: vi.fn(),
}));
vi.mock("../lib/auth", () => ({
  requireFounder: mocks.requireFounder,
  requireSameOrigin: vi.fn(),
}));
vi.mock("../lib/candidates/service", () => ({
  getDashboard: mocks.getDashboard,
  ranked: vi.fn(),
  roleSchema: { parse: (v: string) => v },
}));
import { AppError } from "../lib/errors";
import { GET as candidates } from "../app/api/candidates/route";
import { GET as rankings } from "../app/api/rankings/route";
import { GET as emails } from "../app/api/emails/route";
afterEach(() => vi.clearAllMocks());
it.each([
  ["candidates", candidates, "/api/candidates?mode=demo"],
  ["rankings", rankings, "/api/rankings?mode=demo&role=PM"],
  ["emails", emails, "/api/emails?mode=demo"],
])(
  "%s requires the founder session even when asking for demo data",
  async (_, handler, path) => {
    mocks.requireFounder.mockRejectedValue(
      new AppError("UNAUTHORIZED", "Sign in.", 401),
    );
    const response = await handler(
      new Request(`https://kargo.example.com${path}`),
    );
    expect(response.status).toBe(401);
    expect(mocks.getDashboard).not.toHaveBeenCalled();
  },
);
