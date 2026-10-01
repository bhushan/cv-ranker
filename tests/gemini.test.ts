import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { evaluate } from "../lib/evaluation/evaluator";
import { rubrics } from "../lib/evaluation/rubrics";
import { extractIdentity, sanitizeCv } from "../lib/candidates/pii";
const raw =
  "Synthetic Person\nsynthetic@example.com\n+91 90000 00001\nExperience\nBuilt a shipment triage tool adopted by three operational teams and reduced unresolved exceptions by 28 percent.";
const cv = () => sanitizeCv(raw, extractIdentity(raw));
beforeEach(() => {
  vi.stubEnv("GEMINI_API_KEY", "test-only-key");
  vi.stubEnv("GEMINI_FREE_TIER_CONFIRMED", "true");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe("structured AI boundary", () => {
  it("sends only sanitized professional payload, validates criteria and computes the final score locally", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        Response.json({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      criteria: rubrics[0].criteria.map((c) => ({
                        criterion_id: c.id,
                        score: 8,
                        evidence:
                          "Built a shipment triage tool adopted by three operational teams and reduced unresolved exceptions by 28 percent.",
                        reasoning: "Specific personal action and adoption.",
                        confidence: 0.8,
                      })),
                    }),
                  },
                ],
              },
            },
          ],
        }),
      );
    vi.stubGlobal("fetch", fetcher);
    const result = await evaluate(
      "00000000-0000-4000-8000-000000000001",
      cv(),
      rubrics[0],
    );
    expect(result.overall_score).toBe(80);
    const requestBody = JSON.parse(fetcher.mock.calls[0][1].body);
    const modelPayload = JSON.parse(requestBody.contents[0].parts[0].text);
    expect(modelPayload).not.toHaveProperty("identity");
    expect(JSON.stringify(modelPayload)).not.toMatch(
      /Synthetic Person|synthetic@example.com|90000|Rohan Desai|Sunita Krishnamurthy/,
    );
    expect(requestBody.generationConfig.responseMimeType).toBe(
      "application/json",
    );
  });
  it("rejects malformed structured responses without saving or fabricating a score", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          Response.json({
            candidates: [
              {
                content: {
                  parts: [{ text: '{"criteria":[] , "overall_score":100}' }],
                },
              },
            ],
          }),
        ),
    );
    await expect(evaluate("id", cv(), rubrics[0])).rejects.toMatchObject({
      code: "GEMINI_INVALID_RESPONSE",
    });
  });
  it("stops at a free-quota response without retrying or using another model", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response("", { status: 429 }));
    vi.stubGlobal("fetch", fetcher);
    await expect(evaluate("id", cv(), rubrics[0])).rejects.toMatchObject({
      code: "GEMINI_QUOTA_EXCEEDED",
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("refuses evaluation until free-tier billing is explicitly confirmed", async () => {
    vi.stubEnv("GEMINI_FREE_TIER_CONFIRMED", "false");
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    await expect(evaluate("id", cv(), rubrics[0])).rejects.toMatchObject({
      code: "SETUP_REQUIRED",
    });
    expect(fetcher).not.toHaveBeenCalled();
  });
});
