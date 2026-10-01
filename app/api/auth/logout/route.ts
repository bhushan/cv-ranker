import { api } from "@/lib/api";
import { authClient } from "@/lib/auth";
export async function POST(request: Request) {
  return api(request, async () => {
    const client = await authClient();
    await client.auth.signOut();
    return { ok: true };
  });
}
