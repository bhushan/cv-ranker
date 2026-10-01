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
  if (response.status === 429)
    throw new AppError(
      "RESEND_QUOTA_EXCEEDED",
      "The email allowance is exhausted. Try again later.",
      503,
    );
  // A 4xx answer means Resend refused the email, so nothing was sent.
  if (response.status >= 400 && response.status < 500)
    throw new AppError(
      "RESEND_REJECTED",
      `Resend rejected this email, so nothing was sent${
        typeof result?.message === "string"
          ? `: ${result.message.slice(0, 300)}`
          : "."
      }`,
      502,
    );
  if (!response.ok)
    throw new AppError(
      "RESEND_FAILED",
      "Email delivery could not be confirmed. This send is locked; check Resend before taking further action.",
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
