"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
export default function Login() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  return (
    <main className="login-wrap">
      <form
        className="login-card"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const form = new FormData(e.currentTarget);
          try {
            const res = await fetch("/api/auth/login", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                email: form.get("email"),
                password: form.get("password"),
              }),
            });
            const data = await res.json();
            if (!res.ok)
              throw new Error(data.error?.message || "Sign in failed.");
            router.push("/?mode=live");
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Sign in failed.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <span className="logo-mark">k</span>
        <h1>Founder sign in</h1>
        <p>Access your private Kargo hiring workspace.</p>
        <label>
          Email
          <input name="email" type="email" autoComplete="email" required />
        </label>
        <label>
          Password
          <input
            name="password"
            type="password"
            autoComplete="current-password"
          />
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <Button disabled={busy}>{busy ? "Signing in…" : "Sign in"}</Button>
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={async (event) => {
            const form = event.currentTarget.closest("form")!;
            const email = form.querySelector<HTMLInputElement>(
              'input[name="email"]',
            )!;
            if (!email.reportValidity()) return;
            setBusy(true);
            setError("");
            setMessage("");
            try {
              const response = await fetch("/api/auth/link", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: email.value }),
              });
              const result = await response.json();
              if (!response.ok)
                throw new Error(
                  result.error?.message || "Unable to request sign-in email.",
                );
              setMessage(result.message);
            } catch (err) {
              setError(
                err instanceof Error
                  ? err.message
                  : "Unable to request sign-in email.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          Email me a sign-in link
        </Button>
        {message && <p role="status">{message}</p>}
        <Link href="/">Explore the demo workspace</Link>
      </form>
    </main>
  );
}
