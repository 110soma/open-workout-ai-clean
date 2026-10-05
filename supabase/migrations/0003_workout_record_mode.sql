-- Phase 4: distinguish verification workouts from production records.
-- Existing rows remain production until an exact, verified session_id is explicitly marked test.

alter table public.workout_sessions
  add column if not exists record_mode text not null default 'production';

alter table public.workout_sessions
  drop constraint if exists workout_sessions_record_mode_check;

alter table public.workout_sessions
  add constraint workout_sessions_record_mode_check
  check (record_mode in ('test', 'production'));

create index if not exists workout_sessions_user_record_mode_idx
  on public.workout_sessions(user_id, record_mode, session_date desc);
