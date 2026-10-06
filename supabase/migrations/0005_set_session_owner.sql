-- A set must belong to the same user as its parent session.
-- RLS on the set's user_id alone does not enforce parent ownership.
-- Existing inconsistent rows cause this migration to fail, not be rewritten.
begin;
alter table public.workout_sets
  add constraint workout_sets_session_owner_fkey
  foreign key (user_id, session_id)
  references public.workout_sessions (user_id, session_id)
  on delete cascade;
commit;
