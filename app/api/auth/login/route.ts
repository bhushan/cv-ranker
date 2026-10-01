import { authClient, requireSameOrigin } from "@/lib/auth";
import { AppError, errorResponse } from "@/lib/errors";
import { z } from "zod";
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const { email, password } = z
      .object({ email: z.string().trim().toLowerCase().pipe(z.email()), password: z.string().min(1).max(200) })
      .parse(await request.json());
    const client = await authClient();
    const { data, error } = await client.auth.signInWithPassword({
      email,
      password,
    });
    if (error || data.user?.id !== process.env.FOUNDER_USER_ID) {
      await client.auth.signOut();
      throw new AppError(
        "UNAUTHORIZED",
        "Email or password is incorrect. Use the founder email and temporary password, or request a sign-in link.",
        401,
      );
    }
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
