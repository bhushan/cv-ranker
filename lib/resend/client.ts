import "server-only";
import { AppError } from "../errors";
export async function deliverEmail(input: {
  id: string;
  to: string;
  subject: string;
  body: string;
}) {
  const key = process.env.RESEND_API_KEY,
    from = process.env.RESEND_FROM_EMAIL;
  if (!key || !from)
    throw new AppError(
      "RESEND_NOT_CONFIGURED",
      "Email delivery is not configured.",
      503,
    );
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `kargo-draft-${input.id}`,
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: input.subject,
      text: input.body,
    }),
    signal: AbortSignal.timeout(15000),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok)
    throw new AppError(
      response.status === 429 ? "RESEND_QUOTA_EXCEEDED" : "RESEND_FAILED",
      response.status === 429
        ? "The free email allowance is exhausted. Please try again later."
        : "Email delivery failed. The send is locked for manual reconciliation.",
      503,
    );
  if (!result?.id || typeof result.id !== "string")
    throw new AppError(
      "RESEND_FAILED",
      "Email delivery could not be confirmed. The send is locked for manual reconciliation.",
      503,
    );
  return result.id as string;
}
