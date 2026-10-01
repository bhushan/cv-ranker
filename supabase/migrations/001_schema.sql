-- Isolated application schema: never alter the host application's public objects.
create schema if not exists kargo;
revoke all on schema kargo from public, anon, authenticated;
grant usage on schema kargo to service_role;
alter default privileges in schema kargo grant all on tables to service_role;
alter default privileges in schema kargo grant all on sequences to service_role;
create extension if not exists pgcrypto;
create table kargo.candidates (
 id uuid primary key default gen_random_uuid(), applied_role text not null check(applied_role in ('PM','SPM')),
 status text not null default 'UPLOADED', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table kargo.candidate_identity (
 candidate_id uuid primary key references kargo.candidates on delete cascade, name text not null, email text not null, phone text
);
create table kargo.candidate_documents (
 id uuid primary key default gen_random_uuid(), candidate_id uuid not null unique references kargo.candidates on delete cascade,
 filename text not null, storage_path text not null unique, extracted_text text, created_at timestamptz not null default now()
);
comment on column kargo.candidate_documents.extracted_text is 'Sanitized professional content only; original private CV is stored in Storage.';
create table kargo.rubrics (
 id uuid primary key default gen_random_uuid(), role text not null check(role in ('PM','SPM')), version integer not null check(version>0),
 criteria_json jsonb not null, source text not null check(source ilike '%historical%'), created_at timestamptz not null default now(), unique(role,version)
);
create table kargo.evaluations (
 id uuid primary key default gen_random_uuid(), candidate_id uuid not null references kargo.candidates on delete cascade,
 role text not null, rubric_version integer not null, overall_score numeric not null check(overall_score between 0 and 100),
 status text not null default 'COMPLETE', created_at timestamptz not null default now(),
 foreign key(role,rubric_version) references kargo.rubrics(role,version), unique(candidate_id,role,rubric_version)
);
create table kargo.evaluation_criteria (
 id uuid primary key default gen_random_uuid(), evaluation_id uuid not null references kargo.evaluations on delete cascade,
 criterion_id text not null, score numeric not null check(score between 0 and 10), weight numeric not null check(weight between 0 and 100),
 evidence text not null, reasoning text not null, confidence numeric not null check(confidence between 0 and 1), unique(evaluation_id,criterion_id)
);
create table kargo.email_drafts (
 id uuid primary key default gen_random_uuid(), candidate_id uuid not null unique references kargo.candidates on delete cascade,
 type text not null check(type in ('INVITATION','REJECTION')), subject text not null, body text not null,
 status text not null default 'PENDING_REVIEW' check(status in ('PENDING_REVIEW','SENDING','SENT','REJECTED')),
 approved_at timestamptz, sent_at timestamptz, resend_id text, error text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table kargo.processing_jobs (
 id uuid primary key default gen_random_uuid(), candidate_id uuid not null unique references kargo.candidates on delete cascade,
 status text not null default 'PENDING', stage text not null default 'PARSE', error text,
 lease_until timestamptz, attempts integer not null default 0,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table kargo.interview_briefs (
 id uuid primary key default gen_random_uuid(), candidate_id uuid not null references kargo.candidates on delete cascade,
 role text not null, rubric_version integer not null, sentences jsonb not null check(jsonb_array_length(sentences)=3),
 foreign key(role,rubric_version) references kargo.rubrics(role,version), unique(candidate_id,role,rubric_version)
);
create table kargo.email_quota_reservations(id uuid primary key references kargo.email_drafts on delete cascade, created_at timestamptz not null default now());
create index evaluations_rank on kargo.evaluations(role,rubric_version,overall_score desc,candidate_id);
create index candidates_created on kargo.candidates(created_at);
create index email_review on kargo.email_drafts(status,created_at);
create index evaluation_criteria_parent on kargo.evaluation_criteria(evaluation_id);
create index briefs_candidate on kargo.interview_briefs(candidate_id);
create index quota_date on kargo.email_quota_reservations(created_at);
-- No browser access: the authenticated founder uses server routes; service_role is server-only.
do $$ declare t text; begin foreach t in array array['candidates','candidate_identity','candidate_documents','rubrics','evaluations','evaluation_criteria','email_drafts','processing_jobs','interview_briefs','email_quota_reservations'] loop execute format('alter table kargo.%I enable row level security',t); execute format('revoke all on kargo.%I from anon, authenticated',t); end loop; end $$;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('kargo-candidate-cvs','kargo-candidate-cvs',false,4194304,array['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document']) on conflict(id) do nothing;
-- Serialize send claims and quota reservations. Failed/ambiguous requests retain their reservation.
create function kargo.claim_email_send(draft_id uuid) returns kargo.email_drafts language plpgsql security definer set search_path=kargo as $$
declare d kargo.email_drafts; begin
 perform pg_advisory_xact_lock(714092);
 select * into d from email_drafts where id=draft_id for update;
 if not found then raise exception 'EMAIL_NOT_FOUND'; end if;
 if d.status <> 'PENDING_REVIEW' then raise exception 'EMAIL_ALREADY_SENT'; end if;
 if (select count(*) from email_quota_reservations where created_at>=date_trunc('day',now())) >=100 or
 (select count(*) from email_quota_reservations where created_at>=date_trunc('month',now())) >=3000 then raise exception 'RESEND_QUOTA_EXCEEDED'; end if;
 insert into email_quota_reservations(id) values(draft_id);
 update email_drafts set status='SENDING',approved_at=now(),updated_at=now(),error=null where id=draft_id returning * into d;
 return d;
end $$;
create function kargo.claim_processing_job(target_id uuid, expected_stage text) returns kargo.processing_jobs language plpgsql security definer set search_path=kargo as $$
declare j kargo.processing_jobs; begin
 select * into j from processing_jobs where candidate_id=target_id for update;
 if not found then raise exception 'JOB_NOT_FOUND'; end if;
 if j.stage<>expected_stage or j.status='COMPLETE' or (j.lease_until is not null and j.lease_until>now()) then raise exception 'JOB_BUSY'; end if;
 if j.attempts>=12 then raise exception 'JOB_RETRY_LIMIT'; end if;
 update processing_jobs set status='PROCESSING', lease_until=now()+interval '120 seconds', attempts=attempts+1,updated_at=now(),error=null where id=j.id returning * into j;
 return j;
end $$;
revoke all on function kargo.claim_email_send(uuid) from public,anon,authenticated;
revoke all on function kargo.claim_processing_job(uuid,text) from public,anon,authenticated;
grant execute on function kargo.claim_email_send(uuid) to service_role;
grant execute on function kargo.claim_processing_job(uuid,text) to service_role;
-- Founder approval is bound to the exact draft revision displayed in the UI.
drop function kargo.claim_email_send(uuid);
create function kargo.claim_email_send(draft_id uuid, expected_updated_at timestamptz) returns kargo.email_drafts language plpgsql security definer set search_path=kargo as $$
declare d kargo.email_drafts; begin
 perform pg_advisory_xact_lock(714092);
 select * into d from email_drafts where id=draft_id for update;
 if not found then raise exception 'EMAIL_NOT_FOUND'; end if;
 if d.status <> 'PENDING_REVIEW' then raise exception 'EMAIL_ALREADY_SENT'; end if;
 if d.updated_at is distinct from expected_updated_at then raise exception 'EMAIL_REVISION_CHANGED'; end if;
 if (select count(*) from email_quota_reservations where created_at>=date_trunc('day',now())) >=100 or
 (select count(*) from email_quota_reservations where created_at>=date_trunc('month',now())) >=3000 then raise exception 'RESEND_QUOTA_EXCEEDED'; end if;
 insert into email_quota_reservations(id) values(draft_id);
 update email_drafts set status='SENDING',approved_at=now(),updated_at=now(),error=null where id=draft_id returning * into d;
 return d;
end $$;
create function kargo.store_evaluation(target_id uuid, evaluation_role text, evaluation_version integer, overall numeric, criteria jsonb) returns uuid language plpgsql security definer set search_path=kargo as $$
declare result uuid; rubric jsonb; begin
 select criteria_json->'criteria' into rubric from rubrics where role=evaluation_role and version=evaluation_version;
 if rubric is null or jsonb_typeof(criteria)<>'array' or jsonb_array_length(criteria)<>jsonb_array_length(rubric) then raise exception 'EVALUATION_INVALID'; end if;
 if exists(select 1 from jsonb_array_elements(rubric) r where (select count(*) from jsonb_array_elements(criteria) c where c->>'criterion_id'=r->>'id')<>1) then raise exception 'EVALUATION_INVALID'; end if;
 if abs(overall-(select sum((c->>'score')::numeric/10*(r->>'weight')::numeric) from jsonb_array_elements(criteria) c join jsonb_array_elements(rubric) r on c->>'criterion_id'=r->>'id'))>0.00000001 then raise exception 'EVALUATION_INVALID'; end if;
 insert into evaluations(candidate_id,role,rubric_version,overall_score) values(target_id,evaluation_role,evaluation_version,overall)
 on conflict(candidate_id,role,rubric_version) do nothing returning id into result;
 if result is null then select id into result from evaluations where candidate_id=target_id and role=evaluation_role and rubric_version=evaluation_version; return result; end if;
 insert into evaluation_criteria(evaluation_id,criterion_id,score,weight,evidence,reasoning,confidence)
 select result,c->>'criterion_id',(c->>'score')::numeric,(r->>'weight')::numeric,c->>'evidence',c->>'reasoning',(c->>'confidence')::numeric
 from jsonb_array_elements(criteria) c join jsonb_array_elements(rubric) r on c->>'criterion_id'=r->>'id';
 return result;
end $$;
create table kargo.ai_quota_reservations(id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now());
alter table kargo.ai_quota_reservations enable row level security;
revoke all on kargo.ai_quota_reservations from anon,authenticated;
create index ai_quota_date on kargo.ai_quota_reservations(created_at);
create function kargo.reserve_ai_call() returns uuid language plpgsql security definer set search_path=kargo as $$
declare result uuid; begin
 perform pg_advisory_xact_lock(714093);
 if (select count(*) from ai_quota_reservations where created_at>=date_trunc('day',now()))>=100 or (select count(*) from ai_quota_reservations where created_at>now()-interval '1 minute')>=10 then raise exception 'GEMINI_QUOTA_EXCEEDED'; end if;
 insert into ai_quota_reservations default values returning id into result; return result;
end $$;
create function kargo.create_candidate(p_role text) returns kargo.candidates language plpgsql security definer set search_path=kargo as $$
declare result kargo.candidates; begin
 perform pg_advisory_xact_lock(714094);
 if (select count(*) from candidates)>=100 then raise exception 'STORAGE_CAPACITY_REACHED'; end if;
 insert into candidates(applied_role) values(p_role) returning * into result; return result;
end $$;
revoke all on function kargo.claim_email_send(uuid,timestamptz), kargo.store_evaluation(uuid,text,integer,numeric,jsonb), kargo.reserve_ai_call(), kargo.create_candidate(text) from public,anon,authenticated;
grant execute on function kargo.claim_email_send(uuid,timestamptz), kargo.store_evaluation(uuid,text,integer,numeric,jsonb), kargo.reserve_ai_call(), kargo.create_candidate(text) to service_role;

grant all on all tables in schema kargo to service_role;
grant all on all sequences in schema kargo to service_role;
