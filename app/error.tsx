"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="plain-page">
      <h1>The workspace could not load.</h1>
      <p>
        The database or a required setting is unavailable. Retry, and if it
        keeps failing, check the Supabase migrations and Vercel environment
        variables.
      </p>
      <Button onClick={reset}>Try again</Button>
      <Link className="text-button" href="/login">
        Back to sign in
      </Link>
    </main>
  );
}
