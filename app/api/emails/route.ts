import { api } from "@/lib/api";
import { getDashboard } from "@/lib/candidates/service";
export async function GET(request: Request) {
  return api(request, async () =>
    (await getDashboard()).candidates.flatMap((c) =>
      c.email ? [{ ...c.email, identity: c.identity }] : [],
    ),
  );
}
