"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button";
import { request } from "@/lib/client-api";
import { STAGES, StageList } from "./stage-list";
export function ResumeProcessing({
  candidateId,
  stage,
  error,
}: {
  candidateId: string;
  stage: string;
  error: string | null;
}) {
  const router = useRouter();
  const start = Math.max(
    0,
    STAGES.findIndex((s) => s.id === stage),
  );
  const [current, setCurrent] = useState(start);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState(error);
  async function resume() {
    setBusy(true);
    setFailure(null);
    try {
      for (let i = start; i < STAGES.length; i++) {
        setCurrent(i);
        await request(`/api/candidates/${candidateId}/process`, "POST", {
          stage: STAGES[i].id,
        });
      }
      setCurrent(STAGES.length);
      router.refresh();
    } catch (err) {
      setFailure(err instanceof Error ? err.message : "Processing stopped.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="callout">
      <div>
        <h2>Processing stopped before it finished</h2>
        <p className="muted">
          Scoring runs in steps while this page is open. Resume to continue from
          where it stopped.
        </p>
      </div>
      <StageList current={current} running={busy} failed={!!failure} />
      {failure && (
        <p className="error" role="alert">
          {failure}
        </p>
      )}
      <Button disabled={busy} onClick={resume}>
        {busy ? "Processing…" : "Resume processing"}
      </Button>
    </section>
  );
}
