-- Server-only commit journal. Never grant browser roles access.
begin;
create table public.workout_commit_requests (
 session_id text primary key, user_id uuid not null references auth.users(id),
 snapshot_hash text not null, status text not null default 'pending'
 check (status in ('pending','processing','committed','failed','review')),
 owner_token uuid, plan jsonb, write_started boolean not null default false,
 audit_started boolean not null default false, phase text not null default 'pending',
 updated_at timestamptz not null default now()
);
create table public.workout_commit_mutex (
 id integer primary key check (id=1), owner_token uuid, session_id text
);
insert into public.workout_commit_mutex(id) values(1);
alter table public.workout_commit_requests enable row level security;
alter table public.workout_commit_mutex enable row level security;
revoke all on public.workout_commit_requests,public.workout_commit_mutex from public,anon,authenticated;
grant select,insert,update on public.workout_commit_requests,public.workout_commit_mutex to service_role;

-- Global row lock serializes claims for ALL sessions. No expiring lease:
-- a paused Vercel writer must never race a replacement writer.
create function public.workout_commit_gate(p_action text,p_session text,p_user uuid,p_hash text,p_owner uuid,p_plan jsonb default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.workout_commit_requests; m public.workout_commit_mutex;
begin
 select * into m from public.workout_commit_mutex where id=1 for update;
 if p_action='claim' then
  insert into public.workout_commit_requests(session_id,user_id,snapshot_hash)
  values(p_session,p_user,p_hash) on conflict(session_id) do nothing;
  select * into r from public.workout_commit_requests where session_id=p_session for update;
  if r.user_id<>p_user or r.snapshot_hash<>p_hash then raise exception 'snapshot_conflict'; end if;
  if r.status='committed' then return to_jsonb(r); end if;
  if m.owner_token is not null then return jsonb_build_object('status','busy'); end if;
  update public.workout_commit_mutex set owner_token=p_owner,session_id=p_session where id=1;
  update public.workout_commit_requests set status='processing',owner_token=p_owner,updated_at=now()
  where session_id=p_session returning * into r;
  return to_jsonb(r);
 end if;
 select * into r from public.workout_commit_requests where session_id=p_session for update;
 if not found or r.user_id is distinct from p_user or r.snapshot_hash is distinct from p_hash or r.owner_token is distinct from p_owner
 or m.owner_token is distinct from p_owner or m.session_id is distinct from p_session then
  raise exception 'ownership_lost';
 end if;
 if p_action='plan' then
  if r.write_started or (r.plan is not null and r.plan<>p_plan) then raise exception 'plan_immutable'; end if;
  update public.workout_commit_requests set plan=p_plan,phase='validated' where session_id=p_session;
 elsif p_action='write' then
  if r.write_started or r.plan is null then raise exception 'write_already_started'; end if;
  update public.workout_commit_requests set write_started=true,phase='write_started' where session_id=p_session;
 elsif p_action='audit' then
  if r.audit_started then raise exception 'audit_already_started'; end if;
  update public.workout_commit_requests set audit_started=true,phase='audit_started' where session_id=p_session;
 elsif p_action in ('complete','review') then
  update public.workout_commit_requests set status=case when p_action='complete' then 'committed' else 'review' end,
   phase=case when p_action='complete' then 'readback_match' else 'needs_review' end where session_id=p_session;
  update public.workout_commit_mutex set owner_token=null,session_id=null where id=1;
 elsif p_action<>'check' then raise exception 'unknown_action';
 end if;
 update public.workout_commit_requests set updated_at=now() where session_id=p_session returning * into r;
 return to_jsonb(r);
end $$;
revoke all on function public.workout_commit_gate(text,text,uuid,text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.workout_commit_gate(text,text,uuid,text,uuid,jsonb) to service_role;
commit;
