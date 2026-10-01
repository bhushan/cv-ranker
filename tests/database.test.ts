import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
let db: PGlite;
let candidate: string;
let draft: string;
let revision: string;
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role; create schema storage; create table public.candidates(marker text); insert into public.candidates values('existing meera data');
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);`);
  const schema = readFileSync(
    "supabase/migrations/001_schema.sql",
    "utf8",
  ).replace("create extension if not exists pgcrypto;", "");
  await db.exec(schema);
  await db.exec(
    readFileSync("supabase/migrations/002_historical_rubrics.sql", "utf8"),
  );
  await db.exec("set search_path = kargo");
  const c = await db.query<{ id: string }>(
    `select id from create_candidate('PM')`,
  );
  candidate = c.rows[0].id;
  const d = await db.query<{ id: string; revision: string }>(
    `insert into email_drafts(candidate_id,type,subject,body) values($1,'INVITATION','Invitation','Hello') returning id,updated_at::text as revision`,
    [candidate],
  );
  draft = d.rows[0].id;
  revision = d.rows[0].revision;
}, 30000);
afterAll(async () => {
  await db?.close();
});
describe("real PostgreSQL migrations and atomic persistence", () => {
  it("isolates Kargo tables and storage from existing public application data", async () => {
    const legacy = await db.query<{ marker: string }>(
      "select marker from public.candidates",
    );
    expect(legacy.rows).toEqual([{ marker: "existing meera data" }]);
    const bucket = await db.query<{ id: string; public: boolean }>(
      "select id,public from storage.buckets",
    );
    expect(bucket.rows).toEqual([{ id: "kargo-candidate-cvs", public: false }]);
    const grants = await db.query<{
      anon: boolean;
      authenticated: boolean;
      service: boolean;
    }>(
      "select has_schema_privilege('anon','kargo','USAGE') anon,has_schema_privilege('authenticated','kargo','USAGE') authenticated,has_schema_privilege('service_role','kargo','USAGE') service",
    );
    expect(grants.rows).toEqual([
      { anon: false, authenticated: false, service: true },
    ]);
  });
  it("stores both historically sourced rubric versions with weights totaling 100", async () => {
    const r = await db.query<{ role: string; weight: number }>(
      `select role,sum((c->>'weight')::numeric)::int weight from rubrics,jsonb_array_elements(criteria_json->'criteria') c group by role`,
    );
    expect(r.rows).toHaveLength(2);
    expect(r.rows.every((x) => x.weight === 100)).toBe(true);
  });
  it("validates IDs, deterministic totals, and rolls back failed criterion insertions", async () => {
    const r = await db.query<{ criteria: { id: string }[] }>(
      `select criteria_json->'criteria' criteria from rubrics where role='PM'`,
    );
    const criteria = r.rows[0].criteria.map((x) => ({
      criterion_id: x.id,
      score: 8,
      evidence: "Built workflow",
      reasoning: "Specific result",
      confidence: 0.9,
    }));
    await expect(
      db.query(`select store_evaluation($1,'PM',1,80,$2::jsonb)`, [
        candidate,
        JSON.stringify(criteria.slice(1)),
      ]),
    ).rejects.toThrow("EVALUATION_INVALID");
    await expect(
      db.query(`select store_evaluation($1,'PM',1,90,$2::jsonb)`, [
        candidate,
        JSON.stringify(criteria),
      ]),
    ).rejects.toThrow("EVALUATION_INVALID");
    await expect(
      db.query(`select store_evaluation($1,'PM',1,80,$2::jsonb)`, [
        candidate,
        JSON.stringify(
          criteria.map((c, i) => ({ ...c, confidence: i === 0 ? 2 : 0.9 })),
        ),
      ]),
    ).rejects.toThrow();
    expect(
      (
        await db.query<{ count: number }>(
          `select count(*)::int count from evaluations`,
        )
      ).rows[0].count,
    ).toBe(0);
    const first = await db.query<{ id: string }>(
      `select store_evaluation($1,'PM',1,80,$2::jsonb) id`,
      [candidate, JSON.stringify(criteria)],
    );
    const second = await db.query<{ id: string }>(
      `select store_evaluation($1,'PM',1,80,$2::jsonb) id`,
      [candidate, JSON.stringify(criteria)],
    );
    expect(first.rows[0].id).toBe(second.rows[0].id);
    expect(
      (
        await db.query<{ count: number }>(
          `select count(*)::int count from evaluation_criteria`,
        )
      ).rows[0].count,
    ).toBe(criteria.length);
  });
  it("rejects unseen draft revisions without consuming quota", async () => {
    await expect(
      db.query(`select claim_email_send($1,'2000-01-01'::timestamptz)`, [
        draft,
      ]),
    ).rejects.toThrow("EMAIL_REVISION_CHANGED");
    expect(
      (
        await db.query<{ count: number }>(
          `select count(*)::int count from email_quota_reservations`,
        )
      ).rows[0].count,
    ).toBe(0);
  });
  it("permits only one send claim even when requests arrive concurrently", async () => {
    const results = await Promise.allSettled([
      db.query(`select claim_email_send($1,$2::timestamptz)`, [
        draft,
        revision,
      ]),
      db.query(`select claim_email_send($1,$2::timestamptz)`, [
        draft,
        revision,
      ]),
    ]);
    expect(results.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    expect(
      (
        await db.query<{ status: string }>(
          `select status from email_drafts where id=$1`,
          [draft],
        )
      ).rows[0].status,
    ).toBe("SENDING");
    expect(
      (
        await db.query<{ count: number }>(
          `select count(*)::int count from email_quota_reservations`,
        )
      ).rows[0].count,
    ).toBe(1);
  });
  it("enforces conservative AI minute quota", async () => {
    for (let i = 0; i < 10; i++) await db.query(`select reserve_ai_call()`);
    await expect(db.query(`select reserve_ai_call()`)).rejects.toThrow(
      "GEMINI_QUOTA_EXCEEDED",
    );
  });
  it("enforces daily Resend quota before changing draft status", async () => {
    await db.exec("begin");
    try {
      await db.exec(`insert into candidates(applied_role) select 'PM' from generate_series(1,99);
    insert into email_drafts(candidate_id,type,subject,body) select id,'INVITATION','Invitation','Hello' from candidates where id not in (select candidate_id from email_drafts);
    insert into email_quota_reservations(id) select id from email_drafts where id not in(select id from email_quota_reservations);`);
      const latest = await db.query<{ revision: string }>(
        `update email_drafts set status='PENDING_REVIEW' where id=$1 returning updated_at::text revision`,
        [draft],
      );
      await expect(
        db.query(`select claim_email_send($1,$2::timestamptz)`, [
          draft,
          latest.rows[0].revision,
        ]),
      ).rejects.toThrow("RESEND_QUOTA_EXCEEDED");
    } finally {
      await db.exec("rollback");
    }
  });
  it("enforces candidate storage capacity atomically", async () => {
    await db.exec(
      `insert into candidates(applied_role) select 'PM' from generate_series(1,99)`,
    );
    await expect(db.query(`select create_candidate('SPM')`)).rejects.toThrow(
      "STORAGE_CAPACITY_REACHED",
    );
  });
});
describe("atomic synthetic seed", () => {
  it("rolls back the entire seed on invalid records and never overwrites existing candidates", async () => {
    const seedDb = new PGlite();
    try {
      await seedDb.exec(
        `create role anon; create role authenticated; create role service_role; create schema storage; create table public.candidates(marker text); insert into public.candidates values('existing meera data'); create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);`,
      );
      await seedDb.exec(
        readFileSync("supabase/migrations/001_schema.sql", "utf8").replace(
          "create extension if not exists pgcrypto;",
          "",
        ),
      );
      await seedDb.exec(
        readFileSync("supabase/migrations/002_historical_rubrics.sql", "utf8"),
      );
      await seedDb.exec(
        readFileSync("supabase/migrations/003_atomic_seed.sql", "utf8"),
      );
      await seedDb.exec("set search_path = kargo");
      const rubrics = await seedDb.query<{
        role: string;
        criteria: { id: string }[];
      }>(
        `select role,criteria_json->'criteria' criteria from rubrics order by role`,
      );
      const records = [0, 1].map((i) => ({
        id: `00000000-0000-4000-8000-00000000000${i}`,
        applied_role: "PM",
        created_at: "2026-01-01T00:00:00Z",
        identity: {
          name: `Synthetic ${i}`,
          email: `synthetic${i}@example.com`,
          phone: "",
        },
        evaluations: rubrics.rows.map((r) => ({
          role: r.role,
          rubric_version: 1,
          overall_score: 80,
          criteria: r.criteria.map((c) => ({
            criterion_id: c.id,
            score: 8,
            evidence: "Synthetic evidence",
            reasoning: "Demonstration",
            confidence: 0.9,
          })),
        })),
        briefs: { PM: ["Experience.", "Match.", "Investigate."] },
        email: {
          id: `00000000-0000-4000-9000-00000000000${i}`,
          type: "INVITATION",
          subject: "Invite",
          body: "Hello",
        },
      }));
      const invalid = structuredClone(records);
      invalid[1].email.type = "INVALID";
      await expect(
        seedDb.query(`select seed_synthetic_candidates($1::jsonb)`, [
          JSON.stringify(invalid),
        ]),
      ).rejects.toThrow();
      expect(
        (
          await seedDb.query<{ count: number }>(
            `select count(*)::int count from candidates`,
          )
        ).rows[0].count,
      ).toBe(0);
      expect(
        (
          await seedDb.query<{ count: number }>(
            `select count(*)::int count from evaluations`,
          )
        ).rows[0].count,
      ).toBe(0);
      await seedDb.query(`select seed_synthetic_candidates($1::jsonb)`, [
        JSON.stringify(records),
      ]);
      expect(
        (
          await seedDb.query<{ count: number }>(
            `select count(*)::int count from candidates`,
          )
        ).rows[0].count,
      ).toBe(2);
      expect(
        (
          await seedDb.query<{ count: number }>(
            `select count(*)::int count from evaluations`,
          )
        ).rows[0].count,
      ).toBe(4);
      await expect(
        seedDb.query(`select seed_synthetic_candidates($1::jsonb)`, [
          JSON.stringify(records),
        ]),
      ).rejects.toThrow("SEED_NOT_EMPTY");
      expect(
        (
          await seedDb.query<{ count: number }>(
            `select count(*)::int count from candidates`,
          )
        ).rows[0].count,
      ).toBe(2);
    } finally {
      await seedDb.close();
    }
  }, 30000);
});
