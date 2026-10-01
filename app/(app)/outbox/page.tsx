import { getWorkspace } from "@/lib/workspace";
import { Outbox } from "@/components/outbox";
import { scoreFor } from "@/lib/view";
export default async function OutboxPage({
  searchParams,
}: {
  searchParams: Promise<{ draft?: string }>;
}) {
  const [{ draft }, { candidates }] = await Promise.all([
    searchParams,
    getWorkspace(),
  ]);
  // Pending first, invitations before rejections, strongest candidate first.
  const best = (c: (typeof candidates)[number]) =>
    Math.max(scoreFor(c, "PM") ?? 0, scoreFor(c, "SPM") ?? 0);
  const withEmail = candidates
    .filter((c) => c.email)
    .sort(
      (a, b) =>
        Number(b.email!.status === "PENDING_REVIEW") -
          Number(a.email!.status === "PENDING_REVIEW") ||
        Number(b.email!.type === "INVITATION") -
          Number(a.email!.type === "INVITATION") ||
        best(b) - best(a),
    );
  const selected =
    withEmail.find((c) => c.email!.id === draft) ??
    withEmail.find((c) => c.email!.status === "PENDING_REVIEW") ??
    withEmail[0];
  const pending = withEmail.filter(
    (c) => c.email!.status === "PENDING_REVIEW",
  ).length;
  return (
    <>
      <header className="page-head">
        <div>
          <h1>Outbox</h1>
          <p>
            {pending
              ? `${pending} ${pending === 1 ? "email is" : "emails are"} waiting for your approval. Nothing is sent until you approve it.`
              : "Every email has been handled."}
          </p>
        </div>
      </header>
      {withEmail.length ? (
        <Outbox candidates={withEmail} selectedId={selected!.email!.id} />
      ) : (
        <section className="empty-state">
          <h2>No emails yet</h2>
          <p>
            A draft invitation or rejection appears here once a candidate
            finishes both evaluations.
          </p>
        </section>
      )}
    </>
  );
}
