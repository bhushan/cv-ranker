"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import type { Candidate, EmailDraft } from "@/lib/domain";
import {
  emailStatusLabel,
  emailTone,
  isSyntheticAddress,
  nextPendingDraft,
} from "@/lib/view";
import { request } from "@/lib/client-api";
import { Badge } from "./badge";
import { Button } from "./ui/button";
export function Outbox({
  candidates,
  selectedId,
}: {
  candidates: Candidate[];
  selectedId: string;
}) {
  const [notice, setNotice] = useState("");
  const selected = candidates.find((c) => c.email!.id === selectedId)!;
  const groups = [
    [
      "To review",
      candidates.filter((c) => c.email!.status === "PENDING_REVIEW"),
    ],
    ["Handled", candidates.filter((c) => c.email!.status !== "PENDING_REVIEW")],
  ] as const;
  return (
    <div className="outbox">
      <nav className="outbox-list panel" aria-label="Emails">
        {groups.map(([label, list]) =>
          list.length ? (
            <div key={label}>
              <h2 className="list-heading">
                {label}
                <span className="count">{list.length}</span>
              </h2>
              <ul>
                {list.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/outbox?draft=${c.email!.id}`}
                      scroll={false}
                      replace
                      aria-current={
                        c.email!.id === selectedId ? "true" : undefined
                      }
                      onClick={() => setNotice("")}
                    >
                      <span className="list-row">
                        <strong>{c.identity.name}</strong>
                        {c.email!.status !== "PENDING_REVIEW" && (
                          <Badge tone={emailTone(c.email!.status)}>
                            {emailStatusLabel(c.email!.status)}
                          </Badge>
                        )}
                      </span>
                      <small>
                        {c.email!.type === "INVITATION"
                          ? "Interview invitation"
                          : "Rejection"}
                      </small>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null,
        )}
      </nav>
      <div className="outbox-pane">
        {notice && (
          <div className="notice" role="status">
            <Check size={16} />
            <span>{notice}</span>
          </div>
        )}
        <DraftEditor
          key={selected.email!.id + (selected.email!.updated_at ?? "")}
          candidate={selected}
          candidates={candidates}
          onDone={setNotice}
        />
      </div>
    </div>
  );
}
function DraftEditor({
  candidate,
  candidates,
  onDone,
}: {
  candidate: Candidate;
  candidates: Candidate[];
  onDone: (message: string) => void;
}) {
  const router = useRouter();
  const draft = candidate.email!;
  const [subject, setSubject] = useState(draft.subject);
  const [body, setBody] = useState(draft.body);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const editable = draft.status === "PENDING_REVIEW";
  const sample = isSyntheticAddress(candidate.identity.email);
  const dirty = subject !== draft.subject || body !== draft.body;
  async function save(): Promise<EmailDraft> {
    return request<EmailDraft>(`/api/emails/${draft.id}`, "PATCH", {
      subject,
      body,
      expected_updated_at: draft.updated_at,
    });
  }
  function moveOn(message: string) {
    const next = nextPendingDraft(candidates, draft.id);
    onDone(message);
    router.replace(
      next ? `/outbox?draft=${next}` : `/outbox?draft=${draft.id}`,
      {
        scroll: false,
      },
    );
    router.refresh();
  }
  async function act(action: "save" | "reject" | "send") {
    setBusy(true);
    setError("");
    try {
      if (action === "save") {
        await save();
        onDone("Changes saved.");
        router.refresh();
      } else if (action === "reject") {
        await request(`/api/emails/${draft.id}`, "PATCH", {
          status: "REJECTED",
          expected_updated_at: draft.updated_at,
        });
        moveOn(
          `Draft for ${candidate.identity.name} rejected. Nothing was sent.`,
        );
      } else {
        const saved = dirty ? await save() : draft;
        await request(`/api/emails/${draft.id}/send`, "POST", {
          approved: true,
          expected_updated_at: saved.updated_at,
        });
        moveOn(`Sent to ${candidate.identity.name}.`);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "That didn’t work. Try again.",
      );
      setBusy(false);
      setConfirming(false);
    }
  }
  return (
    <article className="panel draft">
      <header className="draft-head">
        <div>
          <h2>
            {draft.type === "INVITATION" ? "Interview invitation" : "Rejection"}
          </h2>
          <p className="muted small">
            To <strong className="ink">{candidate.identity.name}</strong>,{" "}
            {candidate.identity.email}
          </p>
        </div>
        <div className="draft-meta">
          <Badge tone={emailTone(draft.status)}>
            {emailStatusLabel(draft.status)}
          </Badge>
          <Link href={`/candidates/${candidate.id}`} className="text-button">
            View candidate
          </Link>
        </div>
      </header>
      <label className="field">
        Subject
        <input
          value={subject}
          disabled={!editable || busy}
          onChange={(e) => setSubject(e.target.value)}
        />
      </label>
      <label className="field">
        Message
        <textarea
          rows={12}
          value={body}
          disabled={!editable || busy}
          onChange={(e) => setBody(e.target.value)}
        />
      </label>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {draft.status === "SENT" ? (
        <p className="notice">
          <Check size={16} />
          Sent
          {draft.sent_at
            ? ` on ${new Date(draft.sent_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}`
            : ""}
          .
        </p>
      ) : draft.status === "REJECTED" ? (
        <p className="muted">This draft was rejected. Nothing was sent.</p>
      ) : draft.status === "SENDING" ? (
        <p className="muted">
          This send didn’t confirm. Check the Resend dashboard before changing
          it, so the candidate isn’t emailed twice.
        </p>
      ) : confirming ? (
        <div className="confirm">
          <p>
            Send this {draft.type === "INVITATION" ? "invitation" : "rejection"}{" "}
            to <strong>{candidate.identity.email}</strong> now? You can’t unsend
            it.
          </p>
          <div className="form-actions">
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setConfirming(false)}
            >
              Keep editing
            </Button>
            <Button disabled={busy} onClick={() => act("send")}>
              {busy ? "Sending…" : "Send email"}
            </Button>
          </div>
        </div>
      ) : (
        <>
          {sample && (
            <p className="hint">
              This is a sample candidate. Example.com addresses can’t receive
              email, so this draft can’t be sent. You can still edit or reject
              it.
            </p>
          )}
          <div className="form-actions spread">
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => act("reject")}
            >
              Reject draft
            </Button>
            <div className="form-actions">
              <Button
                variant="outline"
                disabled={busy || !dirty}
                onClick={() => act("save")}
              >
                Save changes
              </Button>
              <Button
                disabled={busy || sample || !subject.trim() || !body.trim()}
                onClick={() => setConfirming(true)}
              >
                Approve and send
              </Button>
            </div>
          </div>
        </>
      )}
    </article>
  );
}
