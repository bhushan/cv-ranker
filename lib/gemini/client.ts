import "server-only";
import { z } from "zod";
import { AppError } from "../errors";
export async function generateJson<T>(
  payload: unknown,
  instructions: string,
  schema: z.ZodType<T>,
): Promise<T> {
  if (!process.env.GEMINI_API_KEY)
    throw new AppError(
      "SETUP_REQUIRED",
      "Configure the Gemini free-tier API key to evaluate CVs.",
      503,
    );
  if (process.env.GEMINI_FREE_TIER_CONFIRMED !== "true")
    throw new AppError(
      "SETUP_REQUIRED",
      "Confirm Gemini billing is disabled by setting GEMINI_FREE_TIER_CONFIRMED=true.",
      503,
    );
  const response = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": process.env.GEMINI_API_KEY,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: instructions }] },
        contents: [
          { role: "user", parts: [{ text: JSON.stringify(payload) }] },
        ],
        generationConfig: {
          temperature: 0,
          responseMimeType: "application/json",
          responseJsonSchema: z.toJSONSchema(schema),
          maxOutputTokens: 6000,
        },
      }),
      signal: AbortSignal.timeout(45000),
    },
  ).catch(() => {
    throw new AppError(
      "EVALUATION_FAILED",
      "AI evaluation could not finish. Please retry this stage.",
      502,
    );
  });
  if (response.status === 429)
    throw new AppError(
      "GEMINI_QUOTA_EXCEEDED",
      "AI evaluation quota is temporarily exhausted. Please try again later.",
      429,
    );
  if (!response.ok)
    throw new AppError(
      "EVALUATION_FAILED",
      "Gemini could not evaluate this CV. Check the free-tier API configuration and try again.",
      502,
    );
  const data = await response.json();
  try {
    return schema.parse(
      JSON.parse(
        data.candidates[0].content.parts
          .filter((p: { text?: string }) => p.text)
          .map((p: { text: string }) => p.text)
          .join(""),
      ),
    );
  } catch {
    throw new AppError(
      "GEMINI_INVALID_RESPONSE",
      "AI returned an invalid response. No evaluation was saved; retry this stage.",
      502,
    );
  }
}
