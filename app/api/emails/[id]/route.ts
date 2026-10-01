import { api } from "@/lib/api";
import { candidateIdSchema } from "@/lib/candidates/service";
import { editEmail } from "@/lib/emails/service";
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return api(request, async () => {
    const { id } = await params;
    candidateIdSchema.parse(id);
    return editEmail(id, await request.json());
  });
}
