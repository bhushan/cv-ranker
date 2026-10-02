"use client";
import { Logo } from "./logo";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="login-card"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        setBusy(true);
        setError("");
        try {
          const response = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: form.get("email"),
              password: form.get("password"),
            }),
          });
          const result = await response.json().catch(() => ({}));
          if (!response.ok)
            throw new Error(
              result.error?.message || "Sign in failed. Try again.",
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
      <Button disabled={busy}>{busy ? "Signing in…" : "Sign in"}</Button>
    </form>
  );
}
