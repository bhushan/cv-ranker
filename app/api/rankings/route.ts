import { api } from "@/lib/api";
import { getDashboard, ranked, roleSchema } from "@/lib/candidates/service";
export async function GET(request: Request) {
  return api(
    request,
    async () => {
      const p = new URL(request.url).searchParams;
      return ranked(
        await getDashboard(p.get("mode") === "demo" ? "demo" : "live"),
        roleSchema.parse(p.get("role")),
      );
    },
    { publicDemo: true },
  );
}
