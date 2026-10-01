import { Dashboard } from "@/components/dashboard";
import { getDashboard } from "@/lib/candidates/service";
import { AppError } from "@/lib/errors";
import { redirect } from "next/navigation";
export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const mode = (await searchParams).mode === "live" ? "live" : "demo";
  let data;
  try {
    data = await getDashboard(mode);
  } catch (error) {
    if (
      error instanceof AppError &&
      (error.code === "UNAUTHORIZED" || error.code === "SETUP_REQUIRED")
    )
      redirect("/login");
    throw error;
  }
  return <Dashboard initialData={data} />;
}
