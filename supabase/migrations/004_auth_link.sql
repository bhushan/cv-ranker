-- Kargo-only authentication email reservations; shared Supabase Auth is unchanged.
create table kargo.auth_link_requests (id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now());
create index auth_link_requests_created on kargo.auth_link_requests(created_at);
alter table kargo.auth_link_requests enable row level security;
revoke all on kargo.auth_link_requests from anon,authenticated;
grant all on kargo.auth_link_requests to service_role;
create function kargo.reserve_auth_link() returns uuid language plpgsql security definer set search_path=kargo as $$
declare result uuid; begin
 perform pg_advisory_xact_lock(714092);
 if exists(select 1 from auth_link_requests where created_at>now()-interval '5 minutes') then raise exception 'AUTH_LINK_RATE_LIMITED'; end if;
 if ((select count(*) from email_quota_reservations where created_at>=date_trunc('day',now()))+(select count(*) from auth_link_requests where created_at>=date_trunc('day',now())))>=100 or
 ((select count(*) from email_quota_reservations where created_at>=date_trunc('month',now()))+(select count(*) from auth_link_requests where created_at>=date_trunc('month',now())))>=3000 then raise exception 'RESEND_QUOTA_EXCEEDED'; end if;
 insert into auth_link_requests default values returning id into result;
 return result;
end $$;
revoke all on function kargo.reserve_auth_link() from public,anon,authenticated;
grant execute on function kargo.reserve_auth_link() to service_role;
create or replace function kargo.claim_email_send(draft_id uuid, expected_updated_at timestamptz) returns kargo.email_drafts language plpgsql security definer set search_path=kargo as $$
declare d kargo.email_drafts; begin
 perform pg_advisory_xact_lock(714092);
 select * into d from email_drafts where id=draft_id for update;
 if not found then raise exception 'EMAIL_NOT_FOUND'; end if;
 if d.status <> 'PENDING_REVIEW' then raise exception 'EMAIL_ALREADY_SENT'; end if;
 if d.updated_at is distinct from expected_updated_at then raise exception 'EMAIL_REVISION_CHANGED'; end if;
 if ((select count(*) from email_quota_reservations where created_at>=date_trunc('day',now()))+(select count(*) from auth_link_requests where created_at>=date_trunc('day',now()))) >=100 or
 ((select count(*) from email_quota_reservations where created_at>=date_trunc('month',now()))+(select count(*) from auth_link_requests where created_at>=date_trunc('month',now()))) >=3000 then raise exception 'RESEND_QUOTA_EXCEEDED'; end if;
 insert into email_quota_reservations(id) values(draft_id);
 update email_drafts set status='SENDING',approved_at=now(),updated_at=now(),error=null where id=draft_id returning * into d;
 return d;
end $$;
