import Link from "next/link";
import { Plus } from "lucide-react";
import { getWorkspace } from "@/lib/workspace";
import { shortlistIds } from "@/lib/view";
import { CandidateTable } from "@/components/candidate-table";
import { SeedButton } from "@/components/seed-button";
export default async function CandidatesPage() {
  const { candidates } = await getWorkspace();
  const shortlisted = shortlistIds(candidates);
  const pending = candidates.filter(
    (c) => c.email?.status === "PENDING_REVIEW",
  ).length;
  return (
    <>
      <header className="page-head">
        <div>
          <h1>Candidates</h1>
          <p>
            {candidates.length
              ? `${candidates.length} in the pipeline, ${shortlisted.size} shortlisted across both roles.`
              : "Nobody in the pipeline yet."}
          </p>
        </div>
        <div className="page-actions">
          {pending > 0 && (
            <Link className="btn btn-outline" href="/outbox">
              Review {pending} {pending === 1 ? "email" : "emails"}
            </Link>
          )}
          <Link className="btn btn-primary" href="/upload">
            <Plus size={16} />
            Upload CV
          </Link>
        </div>
      </header>
      {candidates.length ? (
        <CandidateTable
          candidates={candidates}
          shortlisted={[...shortlisted]}
        />
      ) : (
        <section className="empty-state">
          <h2>Add your first candidate</h2>
          <p>
            Upload a PDF or DOCX CV. Kargo scores it against both the PM and SPM
            rubrics and drafts the email for you to approve.
          </p>
          <div className="page-actions">
            <Link className="btn btn-primary" href="/upload">
              <Plus size={16} />
              Upload CV
            </Link>
            <SeedButton />
          </div>
        </section>
      )}
    </>
  );
}
