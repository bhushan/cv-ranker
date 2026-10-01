-- All-or-nothing, founder-triggered seed. Uses the same capacity lock as uploads.
create function kargo.seed_synthetic_candidates(payload jsonb) returns integer
language plpgsql security definer set search_path=kargo as $$
declare c jsonb; e jsonb; b record; total integer; begin
 perform pg_advisory_xact_lock(714094);
 if exists(select 1 from candidates) then raise exception 'SEED_NOT_EMPTY'; end if;
 if jsonb_typeof(payload) is distinct from 'array' then raise exception 'SEED_INVALID'; end if;
 total=jsonb_array_length(payload);
 if total<1 or total>100 then raise exception 'SEED_INVALID'; end if;
 for c in select value from jsonb_array_elements(payload) loop
  if c->'identity'->>'email' not like '%@example.com' then raise exception 'SEED_INVALID'; end if;
  if jsonb_typeof(c->'evaluations') is distinct from 'array' or jsonb_array_length(c->'evaluations')<>2
   or (select count(distinct value->>'role') from jsonb_array_elements(c->'evaluations') where value->>'role' in ('PM','SPM'))<>2 then raise exception 'SEED_INVALID'; end if;
  insert into candidates(id,applied_role,status,created_at)
   values((c->>'id')::uuid,c->>'applied_role','COMPLETE',coalesce((c->>'created_at')::timestamptz,now()));
  insert into candidate_identity(candidate_id,name,email,phone)
   values((c->>'id')::uuid,c->'identity'->>'name',c->'identity'->>'email',c->'identity'->>'phone');
  for e in select value from jsonb_array_elements(c->'evaluations') loop
   perform store_evaluation((c->>'id')::uuid,e->>'role',(e->>'rubric_version')::integer,(e->>'overall_score')::numeric,e->'criteria');
  end loop;
  for b in select key,value from jsonb_each(coalesce(c->'briefs','{}'::jsonb)) loop
   if b.key not in ('PM','SPM') or jsonb_typeof(b.value) is distinct from 'array' then raise exception 'SEED_INVALID'; end if;
   insert into interview_briefs(candidate_id,role,rubric_version,sentences) values((c->>'id')::uuid,b.key,1,b.value);
  end loop;
  if c->'email' is not null and c->'email'<>'null'::jsonb then
   insert into email_drafts(id,candidate_id,type,subject,body)
    values((c->'email'->>'id')::uuid,(c->>'id')::uuid,c->'email'->>'type',c->'email'->>'subject',c->'email'->>'body');
  end if;
 end loop;
 return total;
end $$;
revoke all on function kargo.seed_synthetic_candidates(jsonb) from public,anon,authenticated;
grant execute on function kargo.seed_synthetic_candidates(jsonb) to service_role;
