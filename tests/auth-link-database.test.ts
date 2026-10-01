import { beforeAll, afterAll, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
let db: PGlite;
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    "create role anon; create role authenticated; create role service_role; create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);",
  );
  await db.exec(
    readFileSync("supabase/migrations/001_schema.sql", "utf8").replace(
      "create extension if not exists pgcrypto;",
      "",
    ),
  );
  await db.exec(readFileSync("supabase/migrations/004_auth_link.sql", "utf8"));
}, 30000);
afterAll(async () => {
  await db?.close();
});
it("atomically limits sign-in links to one per five minutes", async () => {
  await db.query("select kargo.reserve_auth_link()");
  await expect(db.query("select kargo.reserve_auth_link()")).rejects.toThrow(
    "AUTH_LINK_RATE_LIMITED",
  );
});
it("counts hiring email reservations against the authentication free allowance", async () => {
  await db.exec(
    "delete from kargo.auth_link_requests; with c as (insert into kargo.candidates(applied_role) select 'PM' from generate_series(1,100) returning id), d as (insert into kargo.email_drafts(candidate_id,type,subject,body) select c.id,'INVITATION','Hello','Hello' from c returning id) insert into kargo.email_quota_reservations(id) select id from d",
  );
  await expect(db.query("select kargo.reserve_auth_link()")).rejects.toThrow(
    "RESEND_QUOTA_EXCEEDED",
  );
});
