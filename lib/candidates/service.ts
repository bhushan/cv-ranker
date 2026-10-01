import "server-only";
import { z } from "zod";
import { getSupabaseAdmin } from "../supabase/client";
import { requireFounder, isConfigured } from "../auth";
import { AppError } from "../errors";
import type {
  Candidate,
  DashboardData,
  Evaluation,
  Role,
  Rubric,
} from "../domain";
import { getDemoData } from "../demo";
import { rubrics as builtInRubrics } from "../evaluation/rubrics";
import { extractDocument } from "../documents/extraction";
import { validateDocument } from "../documents/validation";
import { extractIdentity, sanitizeCv } from "./pii";
import { evaluate } from "../evaluation/evaluator";
import { rankCandidates, shortlist } from "../rankings/ranking";
import { createEmailDraft } from "../emails/drafts";

export const candidateIdSchema = z.string().uuid();
export const roleSchema = z.enum(["PM", "SPM"]);
export const stageSchema = z.enum(["PARSE", "PM", "SPM", "FINALIZE"]);
function checked<T>(result: { data: T; error: unknown }): NonNullable<T> {
  if (result.error) {
    const code =
      typeof result.error === "object" &&
      result.error !== null &&
      "message" in result.error
        ? String(result.error.message)
        : "";
    if (code.includes("STORAGE_CAPACITY_REACHED"))
      throw new AppError(
        "STORAGE_CAPACITY_REACHED",
        "The free-tier workspace supports up to 100 CVs. Archive reviewed documents before adding more.",
        409,
      );
    console.error("Database operation failed", {
      code: code.split(":")[0].slice(0, 40),
    });
    throw new AppError(
      "DATABASE_ERROR",
      "Could not save or read hiring data. Check Supabase setup and try again.",
      503,
    );
  }
  return result.data as NonNullable<T>;
}
export async function getDashboard(
  mode: "demo" | "live" = "demo",
): Promise<DashboardData> {
  if (mode === "demo") return getDemoData(isConfigured());
  await requireFounder();
  const db = getSupabaseAdmin();
  const rows = checked(
    await db
      .from("candidates")
      .select(
        "*,candidate_identity(*),evaluations(*,evaluation_criteria(*)),email_drafts(*),interview_briefs(*),processing_jobs(*)",
      )
      .order("created_at", { ascending: false })
      .limit(100),
  );
  const rubricRows = checked(
    await db.from("rubrics").select("*").order("version", { ascending: false }),
  );
  const rubrics: Rubric[] = ["PM", "SPM"]
    .map((role) => rubricRows.find((r) => r.role === role))
    .filter(Boolean)
    .map((r) => ({
      role: r.role as Role,
      version: r.version,
      source: r.source,
      criteria: r.criteria_json.criteria,
    }));
  if (rubrics.length !== 2)
    throw new AppError(
      "RUBRIC_SETUP_REQUIRED",
      "Apply the historical-rubric seed migration before processing candidates.",
      503,
    );
  const candidates: Candidate[] = rows.map((row) => ({
    id: row.id,
    applied_role: row.applied_role,
    status: row.status,
    created_at: row.created_at,
    identity: row.candidate_identity ?? {
      name: "Awaiting extraction",
      email: "",
      phone: "",
    },
    evaluations: row.evaluations
      .filter((e: { role: Role; rubric_version: number }) =>
        rubrics.some(
          (r) => r.role === e.role && r.version === e.rubric_version,
        ),
      )
      .map(
        (e: {
          role: Role;
          rubric_version: number;
          overall_score: number;
          status: string;
          evaluation_criteria: Evaluation["criteria"];
        }) => ({
          ...e,
          overall_score: Number(e.overall_score),
          criteria: e.evaluation_criteria,
        }),
      ),
    briefs: Object.fromEntries(
      row.interview_briefs
        .filter((b: { role: Role; rubric_version: number }) =>
          rubrics.some(
            (r) => r.role === b.role && r.version === b.rubric_version,
          ),
        )
        .map((b: { role: Role; sentences: string[] }) => [
          b.role,
          b.sentences.join(" "),
        ]),
    ),
    email:
      (Array.isArray(row.email_drafts)
        ? row.email_drafts[0]
        : row.email_drafts) ?? null,
    job: Array.isArray(row.processing_jobs)
      ? row.processing_jobs[0]
      : row.processing_jobs,
  }));
  return { candidates, rubrics, mode: "live", configured: true };
}
export function ranked(data: DashboardData, role: Role) {
  return rankCandidates(
    data.candidates
      .filter((c) => c.status === "COMPLETE" && c.evaluations.length === 2)
      .map((c) => ({
        ...c,
        overall_score: c.evaluations.find((e) => e.role === role)!
          .overall_score,
      })),
  );
}
export async function uploadCandidate(form: FormData) {
  const role = roleSchema.parse(form.get("applied_role"));
  const file = form.get("file");
  if (!(file instanceof File))
    throw new AppError("INVALID_FILE", "Choose a PDF or DOCX CV.");
  if (file.size > 4 * 1024 * 1024)
    throw new AppError("FILE_TOO_LARGE", "CV files must be 4 MB or smaller.");
  const bytes = Buffer.from(await file.arrayBuffer());
  const type = validateDocument(file.name, bytes);
  const db = getSupabaseAdmin();
  const candidate = checked(await db.rpc("create_candidate", { p_role: role }));
  const storagePath = `${candidate.id}/cv.${type === "PDF" ? "pdf" : "docx"}`;
  try {
    checked(
      await db.storage
        .from("candidate-cvs")
        .upload(storagePath, bytes, {
          contentType:
            type === "PDF"
              ? "application/pdf"
              : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          upsert: false,
        }),
    );
    // Original filenames can contain identities; keep only a generic name in database/API.
    checked(
      await db
        .from("candidate_documents")
        .insert({
          candidate_id: candidate.id,
          filename: type === "PDF" ? "cv.pdf" : "cv.docx",
          storage_path: storagePath,
        }),
    );
    checked(
      await db
        .from("processing_jobs")
        .insert({ candidate_id: candidate.id, stage: "PARSE" }),
    );
    return { candidate: { id: candidate.id, status: "UPLOADED" } };
  } catch (error) {
    await db.storage.from("candidate-cvs").remove([storagePath]);
    await db.from("candidates").delete().eq("id", candidate.id);
    throw error;
  }
}
async function loadDocument(candidateId: string) {
  const db = getSupabaseAdmin();
  const doc = checked(
    await db
      .from("candidate_documents")
      .select("*")
      .eq("candidate_id", candidateId)
      .single(),
  );
  const file = checked(
    await db.storage.from("candidate-cvs").download(doc.storage_path),
  );
  const raw = await extractDocument(
    doc.filename,
    Buffer.from(await file.arrayBuffer()),
  );
  const identity = extractIdentity(raw);
  return { doc, identity, cv: sanitizeCv(raw, identity) };
}
export async function processCandidate(
  id: string,
  stage: z.infer<typeof stageSchema>,
) {
  candidateIdSchema.parse(id);
  const db = getSupabaseAdmin();
  const { data: job, error: claimError } = await db.rpc(
    "claim_processing_job",
    { target_id: id, expected_stage: stage },
  );
  if (claimError || !job)
    throw new AppError(
      "PROCESSING_CONFLICT",
      "This stage is already running or the candidate has advanced. Refresh the dashboard before retrying.",
      409,
    );
  try {
    let next: string = "COMPLETE";
    if (stage === "PARSE") {
      const { identity, cv } = await loadDocument(id);
      checked(
        await db
          .from("candidate_identity")
          .upsert({ candidate_id: id, ...identity }),
      );
      checked(
        await db
          .from("candidate_documents")
          .update({ extracted_text: cv })
          .eq("candidate_id", id),
      );
      next = "PM";
    } else if (stage === "PM" || stage === "SPM") {
      const row = checked(
        await db
          .from("rubrics")
          .select("*")
          .eq("role", stage)
          .order("version", { ascending: false })
          .limit(1)
          .single(),
      );
      const rubric: Rubric = {
        role: stage,
        version: row.version,
        source: row.source,
        criteria: row.criteria_json.criteria,
      };
      const existing = checked(
        await db
          .from("evaluations")
          .select("id")
          .eq("candidate_id", id)
          .eq("role", stage)
          .eq("rubric_version", rubric.version)
          .maybeSingle(),
      );
      if (!existing) {
        const { cv } = await loadDocument(id);
        const { error: quotaError } = await db.rpc("reserve_ai_call");
        if (quotaError)
          throw new AppError(
            "GEMINI_QUOTA_EXCEEDED",
            "AI evaluation quota is temporarily exhausted. Please try again later.",
            429,
          );
        const result = await evaluate(id, cv, rubric);
        checked(
          await db.rpc("store_evaluation", {
            target_id: id,
            evaluation_role: stage,
            evaluation_version: rubric.version,
            overall: result.overall_score,
            criteria: result.criteria,
          }),
        );
      }
      next = stage === "PM" ? "SPM" : "FINALIZE";
    } else {
      const evals = checked(
        await db
          .from("evaluations")
          .select("role,rubric_version")
          .eq("candidate_id", id),
      );
      const rubricVersions = checked(
        await db
          .from("rubrics")
          .select("role,version")
          .order("version", { ascending: false }),
      );
      if (
        !builtInRubrics.every((r) =>
          evals.some(
            (e) =>
              e.role === r.role &&
              e.rubric_version ===
                rubricVersions.find((v) => v.role === r.role)?.version,
          ),
        )
      )
        throw new AppError(
          "EVALUATION_FAILED",
          "Both current PM and SPM evaluations must finish before ranking.",
          409,
        );
      checked(
        await db
          .from("candidates")
          .update({ status: "COMPLETE", updated_at: new Date().toISOString() })
          .eq("id", id),
      );
      await reconcileShortlist();
    }
    checked(
      await db
        .from("processing_jobs")
        .update({
          stage: next,
          status: next === "COMPLETE" ? "COMPLETE" : "PENDING",
          lease_until: null,
          error: null,
          updated_at: new Date().toISOString(),
        })
        .eq("candidate_id", id)
        .eq("lease_until", job.lease_until),
    );
    if (next !== "COMPLETE")
      checked(
        await db
          .from("candidates")
          .update({
            status: "PROCESSING",
            updated_at: new Date().toISOString(),
          })
          .eq("id", id),
      );
    return {
      stage: next,
      status: next === "COMPLETE" ? "COMPLETE" : "PENDING",
    };
  } catch (error) {
    const code = error instanceof AppError ? error.code : "EVALUATION_FAILED";
    await db
      .from("processing_jobs")
      .update({
        status: "FAILED",
        lease_until: null,
        error: code,
        updated_at: new Date().toISOString(),
      })
      .eq("candidate_id", id)
      .eq("lease_until", job.lease_until);
    await db
      .from("candidates")
      .update({ status: "FAILED", updated_at: new Date().toISOString() })
      .eq("id", id);
    throw error;
  }
}
export async function reconcileShortlist() {
  const db = getSupabaseAdmin();
  const data = await getDashboard("live");
  const selected = new Set<string>();
  for (const role of ["PM", "SPM"] as const) {
    const top = shortlist(ranked(data, role));
    for (const c of top) {
      selected.add(c.id);
      if (c.briefs[role]) continue;
      const evaluation = c.evaluations.find((e) => e.role === role)!;
      const strongest = [...evaluation.criteria]
        .filter((c) => c.evidence && c.evidence !== "Evidence unavailable")
        .sort((a, b) => b.score - a.score)[0];
      const criterion = data.rubrics
        .find((r) => r.role === role)!
        .criteria.find((c) => c.id === strongest?.criterion_id);
      // Three independently composed sentences; evidence punctuation is normalized to prevent extras.
      const excerpt = (
        strongest?.evidence ??
        "No supported professional experience was available"
      )
        .replace(/[.!?]+/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 450);
      const sentences = [
        `The strongest documented experience is: ${excerpt}.`,
        `This aligns with the historical hiring pattern of ${criterion?.name.toLowerCase() ?? "evidence-based operational ownership"}.`,
        `Investigate the candidate's personal decision-making role, independence and how the stated results were measured.`,
      ];
      checked(
        await db
          .from("interview_briefs")
          .upsert(
            {
              candidate_id: c.id,
              role,
              rubric_version: evaluation.rubric_version,
              sentences,
            },
            {
              onConflict: "candidate_id,role,rubric_version",
              ignoreDuplicates: true,
            },
          ),
      );
    }
  }
  for (const c of data.candidates.filter((c) => c.status === "COMPLETE")) {
    const draft = createEmailDraft(c.identity.name, selected.has(c.id));
    if (!c.email)
      checked(
        await db
          .from("email_drafts")
          .upsert(
            { candidate_id: c.id, ...draft },
            { onConflict: "candidate_id", ignoreDuplicates: true },
          ),
      );
    else if (c.email.status === "PENDING_REVIEW" && c.email.type !== draft.type)
      checked(
        await db
          .from("email_drafts")
          .update({ ...draft, updated_at: new Date().toISOString() })
          .eq("id", c.email.id)
          .eq("status", "PENDING_REVIEW")
          .eq("updated_at", c.email.updated_at),
      );
  }
}
export async function validateDraftSelection(draftId: string) {
  const data = await getDashboard("live");
  const c = data.candidates.find((c) => c.email?.id === draftId);
  if (!c?.email) throw new AppError("NOT_FOUND", "Email draft not found.", 404);
  const selected = ["PM", "SPM"].some((role) =>
    ranked(data, role as Role)
      .slice(0, 5)
      .some((r) => r.id === c.id),
  );
  if ((c.email.type === "INVITATION") !== selected)
    throw new AppError(
      "SHORTLIST_CHANGED",
      "The shortlist changed. Refresh and review the updated draft before sending.",
      409,
    );
}
