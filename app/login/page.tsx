import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { Logo } from "@/components/logo";
import { requireFounder } from "@/lib/auth";
export const metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";
async function signedIn() {
  try {
    await requireFounder();
    return true;
  } catch {
    return false;
  }
}
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await signedIn()) redirect("/candidates");
  const { error } = await searchParams;
  return (
    <main className="login">
      <section className="login-intro">
        <Logo inverse />
        <div>
          <h1>Hire the way your best people were hired.</h1>
          <p>
            Every CV is scored against what Kargo’s eight historical hires had
            in common. You see the evidence behind each score and approve every
            email before it goes out.
          </p>
        </div>
        <ul className="login-points">
          <li>Scored for PM and SPM from one upload</li>
          <li>Names and contact details removed before scoring</li>
          <li>Nothing is sent without your approval</li>
        </ul>
      </section>
      <section className="login-pane">
        <LoginForm
          initialError={
            error === "invalid_link"
              ? "That sign-in link has expired or was already used. Sign in with your password, or request a new link."
              : ""
          }
        />
      </section>
    </main>
  );
}
