import "server-only";
import { z } from "zod";
import { AppError } from "../errors";
import { getSupabaseAdmin } from "../supabase/client";
import { deliverEmail } from "../resend/client";
import { assertCanSend } from "./drafts";
import { isSyntheticAddress } from "../view";
export const emailEditSchema = z
  .object({
    expected_updated_at: z.string().datetime({ offset: true }),
    subject: z.string().trim().min(1).max(200).optional(),
    body: z.string().trim().min(1).max(10000).optional(),
    status: z.literal("REJECTED").optional(),
  })
  .strict();
export async function editEmail(id: string, input: unknown) {
  const { expected_updated_at, ...changes } = emailEditSchema.parse(input);
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from("email_drafts")
    .update({ ...changes, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "PENDING_REVIEW")
    .eq("updated_at", expected_updated_at)
    .select()
    .single();
  if (error || !data)
    throw new AppError(
      "EMAIL_REVISION_CHANGED",
      "This draft changed. Refresh and review the latest version.",
      409,
    );
  return data;
}
export async function sendEmail(
  id: string,
  approved: boolean,
  expectedUpdatedAt: string,
) {
  assertCanSend("PENDING_REVIEW", approved);
  // Configuration must be checked before atomically consuming a send reservation.
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL)
    throw new AppError(
      "RESEND_NOT_CONFIGURED",
      "Email delivery is not configured.",
      503,
    );
  const db = getSupabaseAdmin();
  // Check the recipient before claiming, so an unsendable draft is never locked.
  const recipient = await recipientFor(id);
  const { data: draft, error } = await db.rpc("claim_email_send", {
    draft_id: id,
    expected_updated_at: expectedUpdatedAt,
  });
  if (error || !draft) {
    const code = error?.message.includes("QUOTA")
      ? "RESEND_QUOTA_EXCEEDED"
      : error?.message.includes("REVISION")
        ? "EMAIL_REVISION_CHANGED"
        : "EMAIL_ALREADY_SENT";
    throw new AppError(
      code,
      code === "EMAIL_REVISION_CHANGED"
        ? "This draft changed. Refresh and review it before approving."
        : code === "RESEND_QUOTA_EXCEEDED"
          ? "The free email allowance is exhausted. Please try again later."
          : "This email has already been sent or is being sent.",
      409,
    );
  }
  try {
    const resendId = await deliverEmail({
      id,
      to: recipient,
      subject: draft.subject,
      body: draft.body,
    });
    const { error: saveError } = await db
      .from("email_drafts")
      .update({
        status: "SENT",
        sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        resend_id: resendId,
        error: null,
      })
      .eq("id", id)
      .eq("status", "SENDING");
    if (saveError)
      throw new AppError(
        "EMAIL_STATUS_SAVE_FAILED",
        "Delivery was accepted, but its status could not be saved. Do not resend; reconcile the provider record.",
        503,
      );
    return { status: "SENT", resend_id: resendId };
  } catch (error) {
    const code = error instanceof AppError ? error.code : "RESEND_FAILED";
    // A definite rejection sent nothing, so the draft goes back to review.
    // Anything else stays SENDING: the provider may have accepted it.
    await db
      .from("email_drafts")
      .update({
        ...(code === "RESEND_REJECTED" ? { status: "PENDING_REVIEW" } : {}),
        error: code,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("status", "SENDING");
    throw error instanceof AppError
      ? error
      : new AppError(
          "RESEND_FAILED",
          "Email delivery could not be confirmed. This send is locked; check Resend before taking further action.",
          503,
        );
  }
}
async function recipientFor(draftId: string) {
  const db = getSupabaseAdmin();
  const { data: draft } = await db
    .from("email_drafts")
    .select("candidate_id")
    .eq("id", draftId)
    .single();
  const { data: identity } = draft
    ? await db
        .from("candidate_identity")
        .select("email")
        .eq("candidate_id", draft.candidate_id)
        .single()
    : { data: null };
  if (!identity?.email)
    throw new AppError(
      "EMAIL_RECIPIENT_MISSING",
      "This candidate has no email address, so the draft can’t be sent.",
    );
  if (isSyntheticAddress(identity.email))
    throw new AppError(
      "EMAIL_RECIPIENT_INVALID",
      "This is a sample candidate with an example.com address, which can’t receive email. Nothing was sent.",
    );
  return identity.email as string;
}
