"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ChevronRight, Search } from "lucide-react";
import type { Candidate, Role } from "@/lib/domain";
import {
  emailStatusLabel,
  emailTone,
  formatScore,
  initials,
  rankIn,
  scoreFor,
} from "@/lib/view";
import { Badge } from "./badge";
const FILTERS = [
  ["all", "All"],
  ["shortlisted", "Shortlisted"],
  ["review", "Email to review"],
  ["processing", "Processing"],
] as const;
type Filter = (typeof FILTERS)[number][0];
type Sort = "recent" | Role;
export function CandidateTable({
  candidates,
  shortlisted,
}: {
  candidates: Candidate[];
  shortlisted: string[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("PM");
  const short = useMemo(() => new Set(shortlisted), [shortlisted]);
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return candidates
      .filter((c) => !q || c.identity.name.toLowerCase().includes(q))
      .filter((c) =>
        filter === "shortlisted"
          ? short.has(c.id)
          : filter === "review"
            ? c.email?.status === "PENDING_REVIEW"
            : filter === "processing"
              ? c.status !== "COMPLETE"
              : true,
      )
      .sort((a, b) =>
        sort === "recent"
          ? b.created_at.localeCompare(a.created_at)
          : (scoreFor(b, sort) ?? -1) - (scoreFor(a, sort) ?? -1),
      );
  }, [candidates, query, filter, sort, short]);
  const counts: Record<Filter, number> = {
    all: candidates.length,
    shortlisted: short.size,
    review: candidates.filter((c) => c.email?.status === "PENDING_REVIEW")
      .length,
    processing: candidates.filter((c) => c.status !== "COMPLETE").length,
  };
  return (
    <section className="panel">
      <div className="toolbar">
        <div className="chips" role="group" aria-label="Filter">
          {FILTERS.filter(([key]) => key === "all" || counts[key] > 0).map(
            ([key, label]) => (
              <button
                key={key}
                className="chip"
                aria-pressed={filter === key}
                onClick={() => setFilter(key)}
              >
                {label}
                <span className="chip-count">{counts[key]}</span>
              </button>
            ),
          )}
        </div>
        <div className="toolbar-end">
          <label className="search">
            <Search size={15} />
            <input
              placeholder="Search by name"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search candidates"
            />
          </label>
          <label className="select-label">
            <span>Sort</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
            >
              <option value="PM">PM score</option>
              <option value="SPM">SPM score</option>
              <option value="recent">Newest</option>
            </select>
          </label>
        </div>
      </div>
      <div className="table-scroll">
        <table className="table">
          <thead>
            <tr>
              <th>Candidate</th>
              <th>Applied for</th>
              <th className="num">PM</th>
              <th className="num">SPM</th>
              <th>Status</th>
              <th>Email</th>
              <th aria-label="Open" />
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} onClick={() => router.push(`/candidates/${c.id}`)}>
                <td>
                  <Link
                    href={`/candidates/${c.id}`}
                    className="person"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span className="avatar">{initials(c.identity.name)}</span>
                    <span>
                      <strong>{c.identity.name}</strong>
                      <small>
                        {c.identity.email || "Contact not extracted"}
                      </small>
                    </span>
                  </Link>
                </td>
                <td className="muted">{c.applied_role}</td>
                {(["PM", "SPM"] as Role[]).map((r) => {
                  const rank = rankIn(candidates, c.id, r);
                  return (
                    <td className="num" key={r}>
                      <span className="figure">
                        {formatScore(scoreFor(c, r))}
                      </span>
                      <small className="rank-hint">
                        {rank ? `#${rank}` : ""}
                      </small>
                    </td>
                  );
                })}
                <td>
                  {c.status !== "COMPLETE" ? (
                    <Badge tone="info">Processing</Badge>
                  ) : short.has(c.id) ? (
                    <Badge tone="signal">Shortlisted</Badge>
                  ) : (
                    <Badge>Not shortlisted</Badge>
                  )}
                </td>
                <td>
                  <Badge tone={emailTone(c.email?.status)}>
                    {emailStatusLabel(c.email?.status)}
                  </Badge>
                </td>
                <td className="chev">
                  <ChevronRight size={16} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && (
          <div className="empty-inline">
            <p>No candidates match.</p>
            <button
              className="text-button strong"
              onClick={() => {
                setQuery("");
                setFilter("all");
              }}
            >
              Clear search and filter
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
