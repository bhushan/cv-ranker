import { z } from "zod";
import { requireSameOrigin } from "@/lib/auth";
import { requestFounderLink } from "@/lib/auth-link";
import { errorResponse } from "@/lib/errors";
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const { email } = z
      .object({ email: z.email().max(254) })
      .parse(await request.json());
    await requestFounderLink(email, new URL(request.url).origin);
    return Response.json(
      {
        ok: true,
        message:
          "If this is the configured founder email, a sign-in link has been sent.",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
