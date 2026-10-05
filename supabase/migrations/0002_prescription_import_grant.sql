-- Apply this once when 0001_initial_schema.sql was run before the admin-import grant was added.
-- It exposes only prescriptions to server-side Secret-key imports; anon receives no access.

grant usage on schema public to service_role;
grant select, insert, update on table public.prescriptions to service_role;
