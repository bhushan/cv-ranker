import { api } from "@/lib/api";
import {
  candidateIdSchema,
  validateDraftSelection,
} from "@/lib/candidates/service";
import { sendEmail } from "@/lib/emails/service";
import { z } from "zod";
export const maxDuration = 30;
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return api(request, async () => {
    const { id } = await params;
    candidateIdSchema.parse(id);
    const body = z
      .object({
        approved: z.literal(true),
        expected_updated_at: z.iso.datetime({ offset: true }),
      })
      .strict()
      .parse(await request.json());
    await validateDraftSelection(id);
    return sendEmail(id, body.approved, body.expected_updated_at);
  });
}
