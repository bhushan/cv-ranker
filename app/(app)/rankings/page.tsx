import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getWorkspace } from "@/lib/workspace";
import type { Role } from "@/lib/domain";
import { ROLE_NAME, formatScore, rankedFor } from "@/lib/view";
import { Strip } from "@/components/strip";
export default async function RankingsPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  const role: Role = (await searchParams).role === "SPM" ? "SPM" : "PM";
  const { candidates, rubrics } = await getWorkspace();
  const rubric = rubrics.find((r) => r.role === role);
  const rows = rankedFor(candidates, role);
  return (
    <>
      <header className="page-head">
        <div>
          <h1>Rankings</h1>
          <p>
            The top five for each role are shortlisted and get an interview
            invitation.
          </p>
        </div>
        <nav className="segmented" aria-label="Role">
          {(["PM", "SPM"] as Role[]).map((r) => (
            <Link
              key={r}
              href={`/rankings?role=${r}`}
              replace
              aria-current={r === role ? "page" : undefined}
            >
              {ROLE_NAME[r]}
            </Link>
          ))}
        </nav>
      </header>
      <section className="panel">
        <div className="legend">
          <Strip
            rubric={rubric}
            evaluation={
              rubric && {
                role,
                rubric_version: rubric.version,
                overall_score: 100,
                status: "COMPLETE",
                criteria: rubric.criteria.map((c) => ({
                  criterion_id: c.id,
                  score: 10,
                  evidence: "",
                  reasoning: "",
                  confidence: 1,
                })),
              }
            }
          />
          <p>
            Each bar is the {role} rubric. A segment’s width is the criterion’s
            weight; its fill is the candidate’s evidenced score.{" "}
            <Link href="/rubrics" className="text-link">
              See the criteria
            </Link>
          </p>
        </div>
        {rows.length ? (
          <ol className="ranking">
            {rows.map(({ candidate: c, score, rank }) => (
              <li key={c.id} className={rank <= 5 ? "top" : undefined}>
                {rank === 6 && (
                  <div className="cutoff" role="separator">
                    Shortlist cut-off
                  </div>
                )}
                <Link href={`/candidates/${c.id}?role=${role}`}>
                  <span className="place">{rank}</span>
                  <span className="who">
                    <strong>{c.identity.name}</strong>
                    <small>Applied for {c.applied_role}</small>
                  </span>
                  <Strip
                    rubric={rubric}
                    evaluation={c.evaluations.find((e) => e.role === role)}
                  />
                  <span className="figure lg">{formatScore(score)}</span>
                  <ChevronRight size={16} className="chev" />
                </Link>
              </li>
            ))}
          </ol>
        ) : (
          <div className="empty-inline">
            <p>No candidate has finished both evaluations yet.</p>
            <Link href="/upload" className="text-button strong">
              Upload a CV
            </Link>
          </div>
        )}
      </section>
    </>
  );
}
