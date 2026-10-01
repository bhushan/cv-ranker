"use client";
import Link from "next/link";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main style={{ maxWidth: 600, margin: "15vh auto", padding: 32 }}>
      <h1>The workspace could not load.</h1>
      <p>
        Check that the Supabase migrations and environment variables are
        configured, then retry.
      </p>
      <button onClick={reset}>Try again</button>
      <p>
        <Link href="/">Open the synthetic demo</Link>
      </p>
    </main>
  );
}
