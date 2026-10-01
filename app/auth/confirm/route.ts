import { NextResponse } from "next/server";
import { authClient } from "@/lib/auth";
export async function GET(request: Request) {
  const url = new URL(request.url);
  const hash = url.searchParams.get("token_hash");
  if (
    hash &&
    hash.length <= 512 &&
    url.searchParams.get("type") === "magiclink"
  ) {
    try {
      const client = await authClient();
      const { data, error } = await client.auth.verifyOtp({
        token_hash: hash,
        type: "magiclink",
      });
      if (!error && data.user?.id === process.env.FOUNDER_USER_ID)
        return NextResponse.redirect(new URL("/?mode=live", url.origin));
      await client.auth.signOut();
    } catch {
      /* Redirect without exposing authentication details. */
    }
  }
  return NextResponse.redirect(
    new URL("/login?error=invalid_link", url.origin),
  );
}
