"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  Users,
  ChartNoAxesColumnIncreasing,
  Mail,
  Plus,
  Search,
  Upload,
  ShieldCheck,
  Check,
  ChevronRight,
  BookOpen,
  LayoutDashboard,
} from "lucide-react";
import type { Candidate, DashboardData, EmailDraft, Role } from "@/lib/domain";
import { Button } from "./ui/button";
import { Tabs, TabsList, TabsTrigger } from "./ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
const score = (c: Candidate, r: Role) =>
  c.evaluations.find((e) => e.role === r)?.overall_score;
const ranked = (cs: Candidate[], r: Role) =>
  cs
    .filter(
      (c) =>
        c.status === "COMPLETE" &&
        c.evaluations.length === 2 &&
        score(c, r) !== undefined,
    )
    .sort(
      (a, b) =>
        score(b, r)! - score(a, r)! ||
        a.created_at.localeCompare(b.created_at) ||
        a.id.localeCompare(b.id),
    );
const fmt = (n: number | undefined) => (n === undefined ? "—" : n.toFixed(1));
function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: string;
}) {
  return <span className={"badge " + tone}>{children}</span>;
}
export function Dashboard({ initialData }: { initialData: DashboardData }) {
  const [data, setData] = useState(initialData),
    [tab, setTab] = useState("Candidates"),
    [role, setRole] = useState<Role>("PM"),
    [filter, setFilter] = useState("All candidates"),
    [query, setQuery] = useState(""),
    [selected, setSelected] = useState<Candidate | null>(null),
    [upload, setUpload] = useState(false),
    [rubrics, setRubrics] = useState(false),
    [editing, setEditing] = useState<EmailDraft | null>(null),
    [confirm, setConfirm] = useState(false),
    [busy, setBusy] = useState(false),
    [stage, setStage] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  // Restore browser-only demo edits after server hydration.
  useEffect(() => {
    if (initialData.mode === "demo") {
      const cached = sessionStorage.getItem("kargo-demo-v1");
      if (cached)
        try {
          // eslint-disable-next-line react-hooks/set-state-in-effect -- Rehydrate browser-only demo storage after server rendering.
          setData(JSON.parse(cached));
        } catch {}
    }
  }, [initialData.mode]);
  function update(next: DashboardData) {
    setData(next);
    if (data.mode === "demo")
      sessionStorage.setItem("kargo-demo-v1", JSON.stringify(next));
  }
  const shortlisted = new Set(
    [
      ...ranked(data.candidates, "PM").slice(0, 5),
      ...ranked(data.candidates, "SPM").slice(0, 5),
    ].map((c) => c.id),
  );
  const visible = data.candidates.filter(
    (c) =>
      (!query || c.identity.name.toLowerCase().includes(query.toLowerCase())) &&
      (filter === "All candidates" ||
        filter === c.applied_role ||
        (filter === "Shortlisted" && shortlisted.has(c.id)) ||
        (filter === "Pending Review" && c.email?.status === "PENDING_REVIEW") ||
        (filter === "Sent" && c.email?.status === "SENT")),
  );
  async function api(path: string, method = "GET", body?: unknown) {
    const res = await fetch(path, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const result = await res.json();
    if (!res.ok)
      throw new Error(
        result.error?.message ||
          result.message ||
          "Something went wrong. Please try again.",
      );
    return result;
  }
  async function refresh() {
    update(await api("/api/candidates"));
  }
  async function emailAction(action: "save" | "send" | "reject") {
    if (!editing) return;
    setBusy(true);
    setError("");
    try {
      if (data.mode === "demo") {
        const draft = {
          ...editing,
          status:
            action === "send"
              ? "SENT"
              : action === "reject"
                ? "REJECTED"
                : "PENDING_REVIEW",
          sent_at: action === "send" ? new Date().toISOString() : null,
        };
        update({
          ...data,
          candidates: data.candidates.map((c) =>
            c.id === draft.candidate_id ? { ...c, email: draft } : c,
          ),
        });
        setNotice(
          action === "send"
            ? "Demo send simulated. No email was delivered."
            : action === "reject"
              ? "Draft rejected."
              : "Draft saved.",
        );
      } else {
        if (action === "send") {
          const saved = await api(`/api/emails/${editing.id}`, "PATCH", {
            subject: editing.subject,
            body: editing.body,
            expected_updated_at: editing.updated_at,
          });
          setEditing({ ...editing, updated_at: saved.updated_at });
          await api(`/api/emails/${editing.id}/send`, "POST", {
            approved: true,
            expected_updated_at: saved.updated_at,
          });
        } else {
          await api(
            `/api/emails/${editing.id}`,
            "PATCH",
            action === "reject"
              ? { status: "REJECTED", expected_updated_at: editing.updated_at }
              : {
                  subject: editing.subject,
                  body: editing.body,
                  expected_updated_at: editing.updated_at,
                },
          );
        }
        await refresh();
        setNotice(
          action === "send" ? "Email sent successfully." : "Draft updated.",
        );
      }
      setEditing(null);
      setConfirm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Email action failed.");
    } finally {
      setBusy(false);
    }
  }
  async function process(form: HTMLFormElement) {
    setBusy(true);
    setError("");
    try {
      setStage("Uploading CV");
      const res = await fetch("/api/candidates", {
        method: "POST",
        body: new FormData(form),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error?.message || "Upload failed.");
      for (const s of ["PARSE", "PM", "SPM", "FINALIZE"]) {
        setStage(
          s === "PARSE"
            ? "Parsing CV and extracting identity"
            : s === "FINALIZE"
              ? "Preparing rankings and drafts"
              : `Evaluating ${s}`,
        );
        await api(`/api/candidates/${result.candidate.id}/process`, "POST", {
          stage: s,
        });
      }
      await refresh();
      setStage("Complete");
      setUpload(false);
      setNotice("Candidate processed for both roles.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Processing failed.");
      try {
        await refresh();
      } catch {}
    } finally {
      setBusy(false);
    }
  }
  async function retryCandidate(c: Candidate) {
    setBusy(true);
    setError("");
    try {
      const stages = ["PARSE", "PM", "SPM", "FINALIZE"];
      const start = stages.indexOf(c.job?.stage || "PARSE");
      if (start < 0)
        throw new Error(
          "Refresh the dashboard to check this candidate’s current processing stage.",
        );
      for (const next of stages.slice(start)) {
        setStage(`Processing ${next}`);
        await api(`/api/candidates/${c.id}/process`, "POST", { stage: next });
      }
      await refresh();
      setSelected(null);
      setNotice("Candidate processing completed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Processing failed.");
      try {
        await refresh();
      } catch {}
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="workspace">
      <aside className="sidebar">
        <Link className="brand" href="/">
          <span className="logo-mark">k</span>kargo
          <span className="brand-dot">.</span>
        </Link>
        <div className="workspace-label">FOUNDER WORKSPACE</div>
        <nav>
          {[
            ["Candidates", Users],
            ["Rankings", ChartNoAxesColumnIncreasing],
            ["Email Review", Mail],
          ].map(([name, Icon]) => (
            <button
              key={String(name)}
              className={tab === name ? "nav-item active" : "nav-item"}
              onClick={() => setTab(String(name))}
            >
              {typeof Icon !== "string" && <Icon size={18} />}
              <span>{String(name)}</span>
              {name === "Email Review" && (
                <span className="nav-count">
                  {
                    data.candidates.filter(
                      (c) => c.email?.status === "PENDING_REVIEW",
                    ).length
                  }
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button className="nav-item" onClick={() => setRubrics(true)}>
            <BookOpen size={18} />
            Hiring rubrics
            <ArrowUpRight size={14} />
          </button>
          <div className="founder">
            <span className="avatar">AK</span>
            <div>
              <strong>Arjun Mehta</strong>
              <small>Founder · Kargo</small>
            </div>
            <span className="online" />
          </div>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <span>
            <LayoutDashboard size={15} /> Hiring workspace{" "}
            <ChevronRight size={13} /> <strong>{tab}</strong>
          </span>
          <div>
            <Badge tone="green">
              <span className="status-dot" />
              Free-tier architecture
            </Badge>
            <Link
              href={data.mode === "demo" ? "/login" : "/"}
              className="text-link"
            >
              {data.mode === "demo" ? "Founder sign in" : "Demo workspace"}
              <ArrowUpRight size={13} />
            </Link>
          </div>
        </header>
        <main className="content">
          <div className="page-heading">
            <div>
              <div className="eyebrow">PEOPLE BUILD THE PRODUCT</div>
              <h1>Your next great hire.</h1>
              <p>
                A clearer view of your pipeline. Every score grounded in
                evidence.
              </p>
            </div>
            <Button
              onClick={() => {
                setError("");
                setUpload(true);
              }}
            >
              <Plus size={17} />
              Upload CV
            </Button>
          </div>
          <div className="demo-banner">
            <ShieldCheck size={18} />
            <span>
              {data.mode === "demo" ? (
                <>
                  <strong>Demo workspace</strong> · Synthetic candidates and
                  illustrative evaluations. Email sends are simulated.
                </>
              ) : (
                <>
                  <strong>Private founder workspace</strong> · Every
                  communication requires your explicit approval.
                </>
              )}
            </span>
            <button onClick={() => setRubrics(true)}>
              View rubric sources
              <ArrowUpRight size={13} />
            </button>
          </div>
          {notice && (
            <div className="notice" role="status">
              <Check size={16} />
              {notice}
              <button onClick={() => setNotice("")}>Dismiss</button>
            </div>
          )}
          {error && !editing && !upload && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <div className="metrics">
            {[
              [
                "Total candidates",
                data.candidates.length,
                "Across your hiring pipeline",
              ],
              [
                "PM candidates",
                data.candidates.filter((c) => c.applied_role === "PM").length,
                "Product Manager applicants",
              ],
              [
                "SPM candidates",
                data.candidates.filter((c) => c.applied_role === "SPM").length,
                "Senior Product Manager applicants",
              ],
              ["Shortlisted", shortlisted.size, "Top five for either role"],
              [
                "Pending emails",
                data.candidates.filter(
                  (c) => c.email?.status === "PENDING_REVIEW",
                ).length,
                "Awaiting your approval",
              ],
            ].map(([label, value, detail], i) => (
              <div className="metric" key={String(label)}>
                <div>
                  {label}
                  <span className="metric-icon">
                    {i === 4 ? (
                      <Mail size={16} />
                    ) : i === 3 ? (
                      <Check size={16} />
                    ) : (
                      <Users size={16} />
                    )}
                  </span>
                </div>
                <strong>{value}</strong>
                <small>{detail}</small>
              </div>
            ))}
          </div>
          <section className="panel">
            <div className="panel-header">
              <Tabs
                value={tab}
                onValueChange={setTab}
                style={{ height: "100%" }}
              >
                <TabsList className="tabs" aria-label="Hiring views">
                  {["Candidates", "Rankings", "Email Review"].map((t) => (
                    <TabsTrigger
                      value={t}
                      className={tab === t ? "selected" : ""}
                      key={t}
                    >
                      {t}
                      {t === "Candidates" && (
                        <span>{data.candidates.length}</span>
                      )}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
              <Badge>Rubrics v{data.rubrics[0]?.version || 1}</Badge>
            </div>
            {tab === "Candidates" ? (
              <>
                <div className="table-tools">
                  <div>
                    <h2>Candidate pipeline</h2>
                    <p>
                      Evaluated against both roles. One consistent hiring
                      standard.
                    </p>
                  </div>
                  <div className="tool-inputs">
                    <label className="search">
                      <Search size={15} />
                      <input
                        placeholder="Search candidates"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        aria-label="Search candidates"
                      />
                    </label>
                    <select
                      aria-label="Filter candidates"
                      value={filter}
                      onChange={(e) => setFilter(e.target.value)}
                    >
                      {[
                        "All candidates",
                        "PM",
                        "SPM",
                        "Shortlisted",
                        "Pending Review",
                        "Sent",
                      ].map((f) => (
                        <option key={f}>{f}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>RANK / APPLIED ROLE</th>
                        <th>CANDIDATE</th>
                        <th>APPLIED ROLE</th>
                        <th>PM SCORE</th>
                        <th>SPM SCORE</th>
                        <th>STATUS</th>
                        <th>EMAIL STATUS</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {visible.map((c) => (
                        <tr key={c.id} onClick={() => setSelected(c)}>
                          <td className="rank-cell">
                            {ranked(data.candidates, c.applied_role).findIndex(
                              (x) => x.id === c.id,
                            ) + 1 || "—"}
                          </td>
                          <td>
                            <button className="candidate-name">
                              <span className="avatar">
                                {c.identity.name
                                  .split(" ")
                                  .map((n) => n[0])
                                  .slice(0, 2)
                                  .join("")}
                              </span>
                              <span>
                                <strong>{c.identity.name}</strong>
                                <small>{c.identity.email}</small>
                              </span>
                            </button>
                          </td>
                          <td>
                            <Badge>{c.applied_role}</Badge>
                          </td>
                          <td>
                            <span className="score">{fmt(score(c, "PM"))}</span>
                            <small className="out-of"> / 100</small>
                          </td>
                          <td>
                            <span className="score">
                              {fmt(score(c, "SPM"))}
                            </span>
                            <small className="out-of"> / 100</small>
                          </td>
                          <td>
                            <Badge
                              tone={shortlisted.has(c.id) ? "green" : "neutral"}
                            >
                              {shortlisted.has(c.id)
                                ? "Shortlisted"
                                : c.status === "COMPLETE"
                                  ? "Evaluated"
                                  : c.status}
                            </Badge>
                          </td>
                          <td>
                            <Badge
                              tone={
                                c.email?.status === "PENDING_REVIEW"
                                  ? "amber"
                                  : c.email?.status === "SENT"
                                    ? "green"
                                    : "neutral"
                              }
                            >
                              {c.email?.status
                                ?.replaceAll("_", " ")
                                .toLowerCase() || "Not drafted"}
                            </Badge>
                          </td>
                          <td>
                            <ChevronRight size={16} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!visible.length && (
                    <div className="empty">
                      No candidates match this filter.
                    </div>
                  )}
                </div>
                <div className="table-footer">
                  <span>{visible.length} candidates · Scores out of 100</span>
                  <span>
                    <ShieldCheck size={14} />
                    Identity excluded from AI evaluations
                  </span>
                </div>
              </>
            ) : tab === "Rankings" ? (
              <>
                <div className="table-tools">
                  <div>
                    <h2>Best fit, backed by evidence</h2>
                    <p>
                      Deterministic weighted scores. The top five in each role
                      are shortlisted.
                    </p>
                  </div>
                  <div className="role-switch">
                    {(["PM", "SPM"] as Role[]).map((r) => (
                      <button
                        className={role === r ? "selected" : ""}
                        key={r}
                        onClick={() => setRole(r)}
                      >
                        {r === "PM" ? "Product Manager" : "Senior PM"}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="rankings">
                  {ranked(data.candidates, role).map((c, i) => (
                    <button
                      className="ranking-row"
                      key={c.id}
                      onClick={() => setSelected(c)}
                    >
                      <span
                        className={"rank-number " + (i < 5 ? "top-rank" : "")}
                      >
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="avatar">
                        {c.identity.name
                          .split(" ")
                          .map((n) => n[0])
                          .slice(0, 2)
                          .join("")}
                      </span>
                      <div className="ranking-info">
                        <strong>{c.identity.name}</strong>
                        <small>
                          Applied for {c.applied_role} ·{" "}
                          {
                            c.evaluations.find((e) => e.role === role)?.criteria
                              .length
                          }{" "}
                          criteria evaluated
                        </small>
                      </div>
                      {i < 5 && <Badge tone="green">Shortlisted</Badge>}
                      <div className="score-bar">
                        <span style={{ width: `${score(c, role)}%` }} />
                      </div>
                      <strong className="ranking-score">
                        {fmt(score(c, role))}
                        <small>/ 100</small>
                      </strong>
                      <ChevronRight size={17} />
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="table-tools">
                  <div>
                    <h2>You have the final word.</h2>
                    <p>Review every message before it leaves the workspace.</p>
                  </div>
                  <Badge tone="amber">Founder approval required</Badge>
                </div>
                <div className="email-grid">
                  {data.candidates
                    .filter((c) => c.email)
                    .map((c) => (
                      <button
                        className="email-card"
                        key={c.id}
                        onClick={() => {
                          setEditing({ ...c.email! });
                          setError("");
                          setConfirm(false);
                        }}
                      >
                        <div>
                          <Badge
                            tone={
                              c.email!.type === "INVITATION"
                                ? "green"
                                : "neutral"
                            }
                          >
                            {c.email!.type === "INVITATION"
                              ? "Interview invitation"
                              : "Rejection"}
                          </Badge>
                          <Badge
                            tone={
                              c.email!.status === "SENT" ? "green" : "amber"
                            }
                          >
                            {c.email!.status.replaceAll("_", " ").toLowerCase()}
                          </Badge>
                        </div>
                        <h3>{c.identity.name}</h3>
                        <small>{c.identity.email}</small>
                        <strong>{c.email!.subject}</strong>
                        <p>{c.email!.body.slice(0, 160)}…</p>
                        <span className="email-card-action">
                          {c.email!.status === "SENT"
                            ? "View sent message"
                            : "Review draft"}
                          <ArrowUpRight size={15} />
                        </span>
                      </button>
                    ))}
                </div>
              </>
            )}
          </section>
          <div className="bottom-note">
            <ShieldCheck size={16} />
            <p>
              <strong>Consistent evaluation. Human decisions.</strong> Scores
              are decision support. Review the evidence and interview before
              making a hiring decision.
            </p>
            <button onClick={() => setRubrics(true)}>
              Explore the methodology
              <ArrowUpRight size={14} />
            </button>
          </div>
        </main>
        <footer>
          Kargo hiring intelligence
          <span>Historical patterns. Clear evidence. Founder control.</span>
        </footer>
      </div>
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        {selected && (
          <DialogContent>
            <DialogTitle className="dialog-heading">
              {selected.identity.name}
            </DialogTitle>
            <DialogDescription>
              Applied for {selected.applied_role} · Criterion-level evaluation
            </DialogDescription>
            <div className="identity-line">
              {selected.identity.email} · {selected.identity.phone}
            </div>
            <div className="detail-scores">
              {(["PM", "SPM"] as Role[]).map((r) => (
                <button
                  className={role === r ? "selected" : ""}
                  key={r}
                  onClick={() => setRole(r)}
                >
                  <span>{r} evaluation</span>
                  <strong>
                    {fmt(score(selected, r))}
                    <small> / 100</small>
                  </strong>
                  <span>
                    Rank #
                    {ranked(data.candidates, r).findIndex(
                      (c) => c.id === selected.id,
                    ) + 1 || "—"}
                  </span>
                </button>
              ))}
            </div>
            {selected.briefs[role] && (
              <div className="brief">
                <div className="eyebrow">
                  THREE-SENTENCE INTERVIEW BRIEF · {role}
                </div>
                <p>{selected.briefs[role]}</p>
              </div>
            )}
            <h3 className="criteria-title">The evidence behind the score</h3>
            {selected.evaluations
              .find((e) => e.role === role)
              ?.criteria.map((c) => {
                const criterion = data.rubrics
                  .find((r) => r.role === role)
                  ?.criteria.find((r) => r.id === c.criterion_id);
                return (
                  <div className="criterion" key={c.criterion_id}>
                    <div className="criterion-heading">
                      <h4>{criterion?.name || c.criterion_id}</h4>
                      <strong>
                        {c.score.toFixed(1)} <small>/ 10</small>
                      </strong>
                    </div>
                    <small>
                      Weight {criterion?.weight}% · Confidence{" "}
                      {Math.round(c.confidence * 100)}%
                    </small>
                    <div className="criterion-body">
                      <div>
                        <label>CV EVIDENCE</label>
                        <p>{c.evidence || "Evidence unavailable in the CV."}</p>
                      </div>
                      <div>
                        <label>REASONING</label>
                        <p>{c.reasoning}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            {selected.job?.error && (
              <p className="error">{selected.job.error}</p>
            )}
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            {data.mode === "live" && selected.status !== "COMPLETE" && (
              <Button disabled={busy} onClick={() => retryCandidate(selected)}>
                {busy ? stage : "Resume processing"}
              </Button>
            )}
            {selected.email && (
              <Button
                variant="outline"
                onClick={() => {
                  setEditing({ ...selected.email! });
                  setSelected(null);
                  setConfirm(false);
                  setError("");
                }}
              >
                <Mail size={16} />
                Review email draft
              </Button>
            )}
          </DialogContent>
        )}
      </Dialog>
      <Dialog open={rubrics} onOpenChange={setRubrics}>
        <DialogContent>
          <DialogTitle className="dialog-heading">
            Built from Kargo’s hiring history.
          </DialogTitle>
          <DialogDescription>
            The eight historical hires are the rubric source. Job descriptions
            do not determine scores.
          </DialogDescription>
          {data.rubrics.map((r) => (
            <section className="rubric-section" key={r.role}>
              <h3>
                {r.role} · Rubric version {r.version}
              </h3>
              <p className="source">{r.source}</p>
              {r.criteria.map((c) => (
                <div className="criterion" key={c.id}>
                  <div className="criterion-heading">
                    <h4>{c.name}</h4>
                    <Badge>{c.weight}%</Badge>
                  </div>
                  <p>{c.description}</p>
                  <p>
                    <strong>Historical basis: </strong>
                    {c.rationale || c.evaluation_guidance}
                  </p>
                  {c.source_hires && (
                    <small>Source hires: {c.source_hires.join(", ")}</small>
                  )}
                </div>
              ))}
            </section>
          ))}
        </DialogContent>
      </Dialog>
      <Dialog open={upload} onOpenChange={(o) => !busy && setUpload(o)}>
        <DialogContent>
          <DialogTitle className="dialog-heading">Add a candidate</DialogTitle>
          <DialogDescription>
            Upload once. Evaluate against both PM and SPM rubrics.
          </DialogDescription>
          {data.mode === "demo" ? (
            <div className="empty">
              <Upload size={32} />
              <h3>Upload in your private workspace</h3>
              <p>
                The public demo uses synthetic data. Sign in to securely upload
                and process real CVs.
              </p>
              <Button asChild>
                <Link href="/login">Founder sign in</Link>
              </Button>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void process(e.currentTarget);
              }}
            >
              <label
                className="upload-zone"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (busy) return;
                  const input =
                    e.currentTarget.querySelector<HTMLInputElement>(
                      'input[type="file"]',
                    );
                  if (input && e.dataTransfer.files.length) {
                    input.files = e.dataTransfer.files;
                    setStage(`Selected ${e.dataTransfer.files[0].name}`);
                  }
                }}
              >
                <Upload size={28} />
                <strong>Choose a CV or drag it here</strong>
                <span>PDF or DOCX · Maximum 4 MB</span>
                <input
                  name="file"
                  type="file"
                  accept=".pdf,.docx"
                  required
                  disabled={busy}
                />
              </label>
              <label className="field">
                Applied role
                <select name="applied_role" disabled={busy}>
                  <option value="PM">Product Manager (PM)</option>
                  <option value="SPM">Senior Product Manager (SPM)</option>
                </select>
              </label>
              {stage && (
                <div className="processing" role="status">
                  <span className={busy ? "spinner" : ""} />
                  {stage}
                </div>
              )}
              {error && (
                <p className="error" role="alert">
                  {error}
                </p>
              )}
              <Button disabled={busy}>
                {busy ? "Processing…" : "Process candidate"}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!editing}
        onOpenChange={(o) => !busy && !o && setEditing(null)}
      >
        {editing && (
          <DialogContent>
            <DialogTitle className="dialog-heading">
              {confirm ? "Approve this message?" : "Review email"}
            </DialogTitle>
            <DialogDescription>
              {data.mode === "demo"
                ? "Demo mode. Sending is simulated and no email is delivered."
                : "Only send after reviewing the recipient and message."}
            </DialogDescription>
            <div className="recipient">
              <strong>To</strong>{" "}
              {
                data.candidates.find((c) => c.id === editing.candidate_id)
                  ?.identity.email
              }
              <Badge>{editing.type.toLowerCase()}</Badge>
            </div>
            {confirm ? (
              <div className="confirm-summary">
                <strong>{editing.subject}</strong>
                <p className="email-body">{editing.body}</p>
                <p className="approval-note">
                  By continuing, you explicitly approve this exact message for
                  sending.
                </p>
              </div>
            ) : (
              <>
                <label className="field">
                  Subject
                  <input
                    value={editing.subject}
                    disabled={editing.status !== "PENDING_REVIEW" || busy}
                    onChange={(e) =>
                      setEditing({ ...editing, subject: e.target.value })
                    }
                  />
                </label>
                <label className="field">
                  Message
                  <textarea
                    rows={11}
                    value={editing.body}
                    disabled={editing.status !== "PENDING_REVIEW" || busy}
                    onChange={(e) =>
                      setEditing({ ...editing, body: e.target.value })
                    }
                  />
                </label>
              </>
            )}
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            {editing.status === "REJECTED" ? (
              <div className="notice">
                This draft was rejected. No email was sent.
              </div>
            ) : editing.status === "SENT" ? (
              <div className="notice">
                <Check size={16} />
                Sent{" "}
                {editing.sent_at
                  ? new Date(editing.sent_at).toLocaleString()
                  : ""}
                {data.mode === "demo" ? " (simulated)" : ""}
              </div>
            ) : (
              <div className="dialog-actions">
                {confirm ? (
                  <>
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() => setConfirm(false)}
                    >
                      Back to editing
                    </Button>
                    <Button disabled={busy} onClick={() => emailAction("send")}>
                      {busy
                        ? "Sending…"
                        : data.mode === "demo"
                          ? "Approve & simulate send"
                          : "Approve & send email"}
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="ghost"
                      disabled={busy}
                      onClick={() => emailAction("reject")}
                    >
                      Reject draft
                    </Button>
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() => emailAction("save")}
                    >
                      Save edits
                    </Button>
                    <Button
                      disabled={
                        busy || !editing.subject.trim() || !editing.body.trim()
                      }
                      onClick={() => setConfirm(true)}
                    >
                      Approve &{" "}
                      {data.mode === "demo" ? "simulate send" : "send"}
                    </Button>
                  </>
                )}
              </div>
            )}
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
