import { AppError } from "../errors";
export function assertCanSend(status: string, approved: boolean) {
  if (!approved)
    throw new AppError(
      "FOUNDER_APPROVAL_REQUIRED",
      "Explicit founder approval is required.",
    );
  if (status !== "PENDING_REVIEW")
    throw new AppError(
      "EMAIL_ALREADY_SENT",
      "This email has already been sent or is being sent.",
      409,
    );
}
export function createEmailDraft(name: string, shortlisted: boolean) {
  const firstName = name.trim().split(/\s+/)[0] || "there";
  return {
    type: shortlisted ? "INVITATION" : "REJECTION",
    status: "PENDING_REVIEW",
    subject: shortlisted
      ? "Interview invitation: Kargo"
      : "Your application to Kargo",
    body: shortlisted
      ? `Hi ${firstName},\n\nThank you for your interest in Kargo. We would like to invite you to an interview to discuss your experience and our product team. Please reply with a few times that work for you, including your time zone.\n\nBest,\nThe Kargo team`
      : `Hi ${firstName},\n\nThank you for your interest in Kargo and for taking the time to apply. After reviewing applications, we have decided to move forward with other candidates for this hiring round. We appreciate your interest and wish you the best in your search.\n\nBest,\nThe Kargo team`,
  };
}
