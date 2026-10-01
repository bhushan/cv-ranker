import { api } from "@/lib/api";
import { getDashboard } from "@/lib/candidates/service";
export async function GET(request: Request) {
  return api(
    request,
    async () => {
      const data = await getDashboard(
        new URL(request.url).searchParams.get("mode") === "demo"
          ? "demo"
          : "live",
      );
      return data.candidates.flatMap((c) =>
        c.email ? [{ ...c.email, identity: c.identity }] : [],
      );
    },
    { publicDemo: true },
  );
}
