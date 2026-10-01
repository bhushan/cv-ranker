import "server-only";
import { AppError } from "./errors";
import { getSupabaseAdmin } from "./supabase/client";
import { deliverEmail } from "./resend/client";

export async function requestFounderLink(email: string, origin: string) {
  const founder = process.env.FOUNDER_USER_ID;
  if (!founder || !process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL)
    throw new AppError(
      "SETUP_REQUIRED",
      "Founder sign in is not configured yet.",
      503,
    );
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.auth.admin.getUserById(founder);
  if (error || !data.user)
    throw new AppError(
      "SETUP_REQUIRED",
      "Founder sign in is not configured yet.",
      503,
    );
  if (data.user.email?.toLowerCase() !== email.toLowerCase()) return;
  const reservation = await admin.rpc("reserve_auth_link");
  if (reservation.error) {
    if (reservation.error.message.includes("AUTH_LINK_RATE_LIMITED"))
      throw new AppError(
        "AUTH_LINK_RATE_LIMITED",
        "Please wait five minutes before requesting another sign-in email.",
        429,
      );
    if (reservation.error.message.includes("RESEND_QUOTA_EXCEEDED"))
      throw new AppError(
        "RESEND_QUOTA_EXCEEDED",
        "The free email allowance is exhausted. Please try again later.",
        503,
      );
    throw new AppError(
      "AUTH_LINK_FAILED",
      "Unable to request a sign-in email. Please try again later.",
      503,
    );
  }
  const link = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: data.user.email!,
  });
  const hash = link.data?.properties?.hashed_token;
  if (link.error || !hash)
    throw new AppError(
      "AUTH_LINK_FAILED",
      "Unable to create a sign-in link. Please try again later.",
      503,
    );
  const url = new URL("/auth/confirm", origin);
  url.searchParams.set("token_hash", hash);
  url.searchParams.set("type", "magiclink");
  await deliverEmail({
    id: `auth-${reservation.data}`,
    to: data.user.email!,
    subject: "Sign in to Kargo",
    body: `Use this one-time link to sign in to your private Kargo hiring workspace:\n\n${url.toString()}\n\nIf you did not request this email, ignore it.`,
  });
}
