import { redirect } from "next/navigation";
import { requireFounder } from "@/lib/auth";
import { getWorkspace } from "@/lib/workspace";
import { AppError } from "@/lib/errors";
import { AppNav } from "@/components/app-nav";
export const dynamic = "force-dynamic";
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let email = "";
  try {
    email = (await requireFounder()).email ?? "";
  } catch (error) {
    if (
      error instanceof AppError &&
      (error.code === "UNAUTHORIZED" || error.code === "SETUP_REQUIRED")
    )
      redirect("/login");
    throw error;
  }
  const { candidates } = await getWorkspace();
  const pending = candidates.filter(
    (c) => c.email?.status === "PENDING_REVIEW",
  ).length;
  return (
    <div className="app">
      <AppNav email={email} pending={pending} />
      <main className="app-main">{children}</main>
    </div>
  );
}
