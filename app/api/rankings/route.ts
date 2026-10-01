import { api } from "@/lib/api";
import { getDashboard, ranked, roleSchema } from "@/lib/candidates/service";
export async function GET(request: Request) {
  return api(request, async () =>
    ranked(
      await getDashboard(),
      roleSchema.parse(new URL(request.url).searchParams.get("role")),
    ),
  );
}
