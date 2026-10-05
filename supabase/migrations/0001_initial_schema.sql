-- Phase 3 schema. Run once in a new Supabase project using the SQL Editor.
-- Browser access is restricted to rows whose user_id matches auth.uid().

create table if not exists public.prescriptions (
  prescription_id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  target_session_id text not null,
  prescription_date date not null,
  source_revision text not null,
  payload jsonb not null,
  local_updated_at timestamptz not null,
  server_updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, target_session_id, source_revision)
);

create table if not exists public.workout_sessions (
  session_id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  prescription_id text,
  session_date date not null,
  status text not null check (status in ('planned', 'active', 'completed_local', 'committed')),
  record_mode text not null default 'production' check (record_mode in ('test', 'production')),
  bodypart text,
  title text,
  workout_payload jsonb not null,
  started_at timestamptz,
  completed_at timestamptz,
  sync_status text not null check (sync_status in ('local_only', 'pending', 'syncing', 'synced', 'conflict', 'error')),
  local_updated_at timestamptz not null,
  server_updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, session_id)
);

create table if not exists public.workout_sets (
  set_id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id text not null references public.workout_sessions(session_id) on delete cascade,
  exercise_id text not null,
  set_no integer not null,
  pair_id text,
  pair_no integer,
  side text check (side in ('L', 'R') or side is null),
  target_weight_kg numeric,
  target_reps_min integer,
  target_reps_max integer,
  target_rir numeric,
  actual_weight_kg numeric,
  actual_reps integer,
  actual_rir numeric,
  completed boolean not null default false,
  completed_at timestamptz,
  local_updated_at timestamptz not null,
  server_updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, set_id)
);

create index if not exists workout_sessions_user_date_idx on public.workout_sessions(user_id, session_date desc);
create index if not exists workout_sets_session_idx on public.workout_sets(user_id, session_id);
create index if not exists workout_sets_exercise_idx on public.workout_sets(user_id, exercise_id);
create index if not exists prescriptions_user_date_idx on public.prescriptions(user_id, prescription_date desc);

create or replace function public.touch_server_updated_at()
returns trigger language plpgsql as $$
begin
  new.server_updated_at = now();
  return new;
end;
$$;

-- This function is only for table triggers. Do not expose it as an API/RPC.
revoke all on function public.touch_server_updated_at() from public, anon, authenticated;

drop trigger if exists prescriptions_touch_server_updated_at on public.prescriptions;
create trigger prescriptions_touch_server_updated_at before update on public.prescriptions
for each row execute function public.touch_server_updated_at();
drop trigger if exists workout_sessions_touch_server_updated_at on public.workout_sessions;
create trigger workout_sessions_touch_server_updated_at before update on public.workout_sessions
for each row execute function public.touch_server_updated_at();
drop trigger if exists workout_sets_touch_server_updated_at on public.workout_sets;
create trigger workout_sets_touch_server_updated_at before update on public.workout_sets
for each row execute function public.touch_server_updated_at();

alter table public.prescriptions enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.workout_sets enable row level security;

-- Explicit Data API privileges. RLS is an additional check; it does not replace GRANT.
-- Start by removing inherited/default table access, then grant only what the PWA needs.
grant usage on schema public to authenticated;
revoke all on table public.prescriptions from public, anon, authenticated;
revoke all on table public.workout_sessions from public, anon, authenticated;
revoke all on table public.workout_sets from public, anon, authenticated;

grant select on table public.prescriptions to authenticated;
grant select, insert, update on table public.workout_sessions to authenticated;
grant select, insert, update on table public.workout_sets to authenticated;

-- Admin-only Prescription import. The Secret key maps to service_role and never ships to the PWA.
grant usage on schema public to service_role;
grant select, insert, update on table public.prescriptions to service_role;

drop policy if exists "prescriptions_select_own" on public.prescriptions;
create policy "prescriptions_select_own" on public.prescriptions for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "workout_sessions_select_own" on public.workout_sessions;
create policy "workout_sessions_select_own" on public.workout_sessions for select to authenticated
using ((select auth.uid()) = user_id);
drop policy if exists "workout_sessions_insert_own" on public.workout_sessions;
create policy "workout_sessions_insert_own" on public.workout_sessions for insert to authenticated
with check ((select auth.uid()) = user_id);
drop policy if exists "workout_sessions_update_own" on public.workout_sessions;
create policy "workout_sessions_update_own" on public.workout_sessions for update to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "workout_sessions_delete_own" on public.workout_sessions;

drop policy if exists "workout_sets_select_own" on public.workout_sets;
create policy "workout_sets_select_own" on public.workout_sets for select to authenticated
using ((select auth.uid()) = user_id);
drop policy if exists "workout_sets_insert_own" on public.workout_sets;
create policy "workout_sets_insert_own" on public.workout_sets for insert to authenticated
with check ((select auth.uid()) = user_id);
drop policy if exists "workout_sets_update_own" on public.workout_sets;
create policy "workout_sets_update_own" on public.workout_sets for update to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "workout_sets_delete_own" on public.workout_sets;
