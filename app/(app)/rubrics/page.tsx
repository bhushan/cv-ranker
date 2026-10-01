import { getWorkspace } from "@/lib/workspace";
import { ROLE_NAME } from "@/lib/view";
export const metadata = { title: "Rubrics" };
export default async function RubricsPage() {
  const { rubrics } = await getWorkspace();
  return (
    <>
      <header className="page-head">
        <div>
          <h1>Rubrics</h1>
          <p className="measure">
            Both rubrics come from what Kargo’s eight historical hires had in
            common, not from the job descriptions. Each criterion is scored 0 to
            10 against a line quoted from the CV, then weighted. Scores support
            your judgement; they do not make the decision.
          </p>
        </div>
      </header>
      <div className="rubrics">
        {rubrics.map((r) => (
          <section className="panel rubric" key={r.role}>
            <header>
              <h2>{ROLE_NAME[r.role]}</h2>
              <span className="muted small">Version {r.version}</span>
            </header>
            <ol className="criteria">
              {r.criteria.map((c) => (
                <li key={c.id}>
                  <div className="criterion-head">
                    <h3>{c.name}</h3>
                    <span className="figure">{c.weight}%</span>
                  </div>
                  <span className="meter" aria-hidden="true">
                    <i style={{ width: `${c.weight * 2.5}%` }} />
                  </span>
                  <p>{c.description}</p>
                  {c.rationale && <p className="muted small">{c.rationale}</p>}
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    </>
  );
}
