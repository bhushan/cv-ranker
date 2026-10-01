"use client";
import { Logo } from "./logo";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
export function LoginForm({ initialError }: { initialError: string }) {
  const router = useRouter();
  const [error, setError] = useState(initialError);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function post(path: string, body: unknown, fallback: string) {
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error?.message || fallback);
    return result;
  }
  return (
    <form
      className="login-card"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        setBusy(true);
        setError("");
        setMessage("");
        try {
          await post(
            "/api/auth/login",
            { email: form.get("email"), password: form.get("password") },
            "Sign in failed. Try again.",
          );
          router.push("/candidates");
          router.refresh();
        } catch (err) {
          setError(err instanceof Error ? err.message : "Sign in failed.");
          setBusy(false);
        }
      }}
    >
      <div className="login-mobile-logo">
        <Logo />
      </div>
      <h2>Sign in</h2>
      <p className="muted">Use your founder account.</p>
      <label className="field">
        Email
        <input name="email" type="email" autoComplete="email" required />
      </label>
      <label className="field">
        Password
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </label>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      <Button disabled={busy}>{busy ? "Signing in…" : "Sign in"}</Button>
      <button
        type="button"
        className="text-button"
        disabled={busy}
        onClick={async (event) => {
          const email = event.currentTarget
            .closest("form")!
            .querySelector<HTMLInputElement>('input[name="email"]')!;
          if (!email.reportValidity()) return;
          setBusy(true);
          setError("");
          setMessage("");
          try {
            const result = await post(
              "/api/auth/link",
              { email: email.value },
              "Unable to request a sign-in email.",
            );
            setMessage(result.message);
          } catch (err) {
            setError(
              err instanceof Error
                ? err.message
                : "Unable to request a sign-in email.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        Email me a sign-in link instead
      </button>
    </form>
  );
}
