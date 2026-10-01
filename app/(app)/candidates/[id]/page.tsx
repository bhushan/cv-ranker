import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Mail } from "lucide-react";
import { getWorkspace } from "@/lib/workspace";
import type { Role } from "@/lib/domain";
import {
  ROLE_NAME,
  emailStatusLabel,
  emailTone,
  formatScore,
  initials,
  rankIn,
  rankedFor,
  scoreFor,
  shortlistIds,
} from "@/lib/view";
import { Badge } from "@/components/badge";
import { Strip } from "@/components/strip";
import { ResumeProcessing } from "@/components/resume-processing";
export default async function CandidatePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ role?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const { candidates, rubrics } = await getWorkspace();
  const c = candidates.find((x) => x.id === id);
  if (!c) notFound();
  const role: Role =
    query.role === "PM" || query.role === "SPM" ? query.role : c.applied_role;
  const rubric = rubrics.find((r) => r.role === role);
  const evaluation = c.evaluations.find((e) => e.role === role);
  const shortlisted = shortlistIds(candidates).has(c.id);
  return (
    <>
      <Link href="/candidates" className="back">
        <ArrowLeft size={15} />
        Candidates
      </Link>
      <header className="page-head person-head">
        <div className="person">
          <span className="avatar xl">{initials(c.identity.name)}</span>
          <span>
            <h1>{c.identity.name}</h1>
            <p>
              Applied for {ROLE_NAME[c.applied_role]}
              {shortlisted && (
                <>
                  {" "}
                  <Badge tone="signal">Shortlisted</Badge>
                </>
              )}
            </p>
          </span>
        </div>
        {c.email && (
          <div className="page-actions">
            <Link
              className={
                c.email.status === "PENDING_REVIEW"
                  ? "btn btn-primary"
                  : "btn btn-outline"
              }
              href={`/outbox?draft=${c.email.id}`}
            >
              <Mail size={16} />
              {c.email.status === "PENDING_REVIEW"
                ? `Review ${c.email.type === "INVITATION" ? "invitation" : "rejection"}`
                : "View email"}
            </Link>
          </div>
        )}
      </header>
      {c.status !== "COMPLETE" && (
        <ResumeProcessing
          candidateId={c.id}
          stage={c.job?.stage ?? "PARSE"}
          error={c.job?.error ?? null}
        />
      )}
      <div className="detail">
        <div className="detail-main">
          <nav className="role-cards" aria-label="Evaluation">
            {(["PM", "SPM"] as Role[]).map((r) => {
              const rank = rankIn(candidates, c.id, r);
              return (
                <Link
                  key={r}
                  href={`/candidates/${c.id}?role=${r}`}
                  scroll={false}
                  replace
                  className="role-card"
                  aria-current={r === role ? "true" : undefined}
                >
                  <span className="role-card-label">{ROLE_NAME[r]}</span>
                  <span className="figure xl">
                    {formatScore(scoreFor(c, r))}
                  </span>
                  <span className="muted small">
                    {rank
                      ? `Rank ${rank} of ${rankedFor(candidates, r).length}`
                      : "Not ranked yet"}
                  </span>
                  <Strip
                    rubric={rubrics.find((x) => x.role === r)}
                    evaluation={c.evaluations.find((e) => e.role === r)}
                  />
                </Link>
              );
            })}
          </nav>
          {c.briefs[role] && (
            <section className="brief">
              <h2>Interview brief</h2>
              <p>{c.briefs[role]}</p>
            </section>
          )}
          <section>
            <h2 className="section-title">Evidence for the {role} score</h2>
            {evaluation ? (
              <ol className="criteria">
                {evaluation.criteria.map((r) => {
                  const criterion = rubric?.criteria.find(
                    (x) => x.id === r.criterion_id,
                  );
                  return (
                    <li key={r.criterion_id}>
                      <div className="criterion-head">
                        <h3>{criterion?.name ?? r.criterion_id}</h3>
                        <span className="figure">
                          {r.score.toFixed(1)}
                          <small>/10</small>
                        </span>
                      </div>
                      <span className="meter" aria-hidden="true">
                        <i style={{ width: `${r.score * 10}%` }} />
                      </span>
                      <p className="muted small">
                        {criterion?.weight}% of the score. Model confidence{" "}
                        {Math.round(r.confidence * 100)}%.
                      </p>
                      {r.evidence ? (
                        <blockquote>{r.evidence}</blockquote>
                      ) : (
                        <p className="missing">
                          The CV has no evidence for this, so it scores zero.
                        </p>
                      )}
                      <p>{r.reasoning}</p>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="muted">
                This evaluation appears once processing finishes.
              </p>
            )}
          </section>
        </div>
        <aside className="detail-aside">
          <section className="aside-block">
            <h2>Contact</h2>
            <dl>
              <dt>Email</dt>
              <dd>{c.identity.email || "Not extracted"}</dd>
              <dt>Phone</dt>
              <dd>{c.identity.phone || "Not provided"}</dd>
              <dt>Added</dt>
              <dd>
                {new Date(c.created_at).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </dd>
            </dl>
            <p className="muted small">
              Contact details are removed from the CV before it is scored.
            </p>
          </section>
          <section className="aside-block">
            <h2>Email</h2>
            {c.email ? (
              <>
                <p>
                  {c.email.type === "INVITATION"
                    ? "Interview invitation"
                    : "Rejection"}{" "}
                  <Badge tone={emailTone(c.email.status)}>
                    {emailStatusLabel(c.email.status)}
                  </Badge>
                </p>
                <p className="muted small">{c.email.subject}</p>
                <Link
                  className="text-button strong"
                  href={`/outbox?draft=${c.email.id}`}
                >
                  Open in outbox
                </Link>
              </>
            ) : (
              <p className="muted small">
                A draft is created when both evaluations finish.
              </p>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}
