# Verification status

Verified on 1 October 2026.

## Completed

- Inspected eight historical hire DOCX CVs, two role descriptions, problem statement, answer key and component map.
- Derived, documented and versioned separate historical-hire PM and SPM rubrics. Both total 100. Both are stored in the isolated Supabase `kargo` schema.
- Built Next.js/TypeScript/Tailwind/shadcn UI and modular server routes.
- The app is login-only (public demo mode removed on 1 October 2026). Founder authentication and authorization protect every page and API, including requests that ask for `mode=demo`.
- 12 synthetic candidates in the live workspace cover both role evaluations, deterministic rankings, criterion evidence/reasoning/confidence, three-sentence shortlist briefs, invitations and rejections.
- PDF and DOCX extraction tests pass. One supplied applicant PDF successfully completed parsing, identity extraction and sanitization; the source was tested outside the repository and not committed.
- PII tests exclude candidate identity and historical-hire names from model payloads; personal/reference/education sections and contact information are stripped.
- Structured Gemini request tests validate schema, typography-tolerant exact evidence (unverifiable quotes score zero), deterministic scoring, quota errors and no paid fallback. These tests mock the provider.
- PostgreSQL migrations executed successfully in PGlite with Supabase-specific role/bucket fixtures. Tests cover atomic scores/rollback/idempotency, stale approvals, concurrent send claims, quota limits, capacity limits and atomic demo seeding.
- 58 tests pass; TypeScript and ESLint pass. Patched dependency audit reports zero vulnerabilities.
- Production builds succeed locally with Webpack and on Vercel with Turbopack.
- Deployed on an authenticated Vercel Hobby team. Signed-out visitors are redirected to sign-in; founder password sign-in verified on production.
- GitHub source includes migrations, tests, README, architecture and a one-minute walkthrough. No original CVs, secret files or API keys are committed.

## Remaining setup and checks

- The isolated `kargo` schema (tables, two historical rubrics, a private CV bucket and 12 synthetic candidates) lives in an existing Supabase project without touching its other tables.
- Supabase, Gemini and Resend variables are configured in Vercel, including `GEMINI_FREE_TIER_CONFIRMED`. Founder login and every signed-in page render on production.
- A real CV upload reached storage and completed the live PM evaluation; the SPM step failed on strict evidence matching, which led to the typography-tolerant matcher. A full live upload-to-ranking run after that fix is still to be confirmed.
- Resend currently rejects sends (the sender domain needs verification), so candidate emails do not deliver yet. No real candidate emails have been sent.
- Signed-in pages were checked visually from server-rendered HTML; click-through of signed-in interactions (approve and send, upload, filters, sign out) in a browser is still to be done.
- Session deck was not supplied; the public applications listing returned 50 files although the problem statement describes 60. The eight required historical hire files were all available and inspected.

Founder sign-in and the private workspace work on production. The full live-provider acceptance checklist is not complete, and no actual candidate emails were sent during development.
