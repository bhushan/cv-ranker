"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Upload } from "lucide-react";
import { Button } from "./ui/button";
import { request } from "@/lib/client-api";
import { STAGES, StageList } from "./stage-list";
type Phase = "pick" | "running" | "failed" | "done";
export function UploadFlow() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [role, setRole] = useState("PM");
  const [phase, setPhase] = useState<Phase>("pick");
  const [current, setCurrent] = useState(-1);
  const [error, setError] = useState("");
  const [candidateId, setCandidateId] = useState("");
  const [dragging, setDragging] = useState(false);
  function choose(f?: File | null) {
    setError("");
    if (!f) return;
    if (!/\.(pdf|docx)$/i.test(f.name))
      return setError("Choose a PDF or DOCX file.");
    if (f.size > 4 * 1024 * 1024)
      return setError(
        "This file is larger than 4 MB. Export a smaller copy and try again.",
      );
    setFile(f);
  }
  async function run() {
    if (!file) return;
    setPhase("running");
    setError("");
    let id = candidateId;
    try {
      if (!id) {
        setCurrent(-1);
        const form = new FormData();
        form.set("file", file);
        form.set("applied_role", role);
        const response = await fetch("/api/candidates", {
          method: "POST",
          body: form,
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok)
          throw new Error(
            result.error?.message || "The upload failed. Try again.",
          );
        id = result.candidate.id as string;
        setCandidateId(id);
      }
      for (let i = Math.max(0, current); i < STAGES.length; i++) {
        setCurrent(i);
        await request(`/api/candidates/${id}/process`, "POST", {
          stage: STAGES[i].id,
        });
      }
      setCurrent(STAGES.length);
      setPhase("done");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Processing stopped.");
      setPhase("failed");
    }
  }
  function reset() {
    setFile(null);
    setPhase("pick");
    setCurrent(-1);
    setCandidateId("");
    setError("");
    if (input.current) input.current.value = "";
  }
  return (
    <section className="panel upload">
      {phase === "pick" ? (
        <>
          <label
            className={dragging ? "dropzone dragging" : "dropzone"}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              choose(e.dataTransfer.files[0]);
            }}
          >
            {file ? <FileText size={26} /> : <Upload size={26} />}
            <strong>
              {file ? file.name : "Drop a CV here or choose a file"}
            </strong>
            <span className="muted small">
              {file
                ? `${(file.size / 1024).toFixed(0)} KB. Choose again to replace it.`
                : "PDF or DOCX, up to 4 MB. Scanned images can’t be read."}
            </span>
            <input
              ref={input}
              className="sr-only"
              type="file"
              accept=".pdf,.docx"
              onChange={(e) => choose(e.target.files?.[0])}
            />
          </label>
          <fieldset className="role-choice">
            <legend>Applied for</legend>
            {[
              ["PM", "Product Manager"],
              ["SPM", "Senior Product Manager"],
            ].map(([value, label]) => (
              <label key={value} className="radio">
                <input
                  type="radio"
                  name="role"
                  value={value}
                  checked={role === value}
                  onChange={() => setRole(value)}
                />
                {label}
              </label>
            ))}
          </fieldset>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <div className="form-actions">
            <Button disabled={!file} onClick={run}>
              Upload and score
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className="upload-file">
            <FileText size={20} />
            <strong>{file?.name}</strong>
            <span className="muted small">Applied for {role}</span>
          </div>
          <StageList
            current={current}
            running={phase === "running"}
            failed={phase === "failed"}
          />
          {phase === "running" && (
            <p className="muted small" role="status">
              {current < 0
                ? "Uploading the file…"
                : "Working. Keep this page open."}
            </p>
          )}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <div className="form-actions">
            {phase === "failed" && (
              <>
                <Button variant="outline" onClick={reset}>
                  Choose another file
                </Button>
                <Button onClick={run}>
                  {candidateId ? "Resume" : "Try again"}
                </Button>
              </>
            )}
            {phase === "done" && (
              <>
                <Button variant="outline" onClick={reset}>
                  Upload another
                </Button>
                <Button asChild>
                  <Link href={`/candidates/${candidateId}`}>
                    Open candidate
                  </Link>
                </Button>
              </>
            )}
          </div>
        </>
      )}
    </section>
  );
}
