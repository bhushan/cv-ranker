import Link from "next/link";
export default function NotFound() {
  return (
    <main className="plain-page">
      <h1>This page does not exist.</h1>
      <p>The link may be mistyped or out of date.</p>
      <Link className="text-button strong" href="/candidates">
        Back to candidates
      </Link>
    </main>
  );
}
