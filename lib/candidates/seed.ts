import "server-only";
import { getDemoData } from "../demo";
import { getSupabaseAdmin } from "../supabase/client";
import { AppError } from "../errors";
export async function seedSyntheticCandidates() {
  const db = getSupabaseAdmin();
  const data = getDemoData();
  const payload = data.candidates.map((c) => ({
    ...c,
    briefs: Object.fromEntries(
      Object.entries(c.briefs).map(([role, brief]) => [
        role,
        brief.match(/[^.!?]+[.!?]/g)?.map((s) => s.trim()),
      ]),
    ),
  }));
  const { error } = await db.rpc("seed_synthetic_candidates", { payload });
  if (error)
    throw new AppError(
      error.message.includes("EMPTY") ? "SEED_NOT_EMPTY" : "SEED_FAILED",
      error.message.includes("EMPTY")
        ? "Seeding is available only for an empty workspace."
        : "Could not seed the workspace. Apply all migrations and check that both historical rubrics are present.",
      409,
    );
  return {
    seeded: data.candidates.length,
    message:
      "Synthetic candidates created. example.com addresses cannot receive live email.",
  };
}
