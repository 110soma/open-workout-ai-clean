# Data management for self-hosters

## Browser-only Demo

Demo data is stored in the separate `open-workout-ai-demo` IndexedDB database. Users can remove it with the browser's site-data controls. It is never sent to Supabase or the official-save API.

## Supabase-connected installation

- **Export:** use the Supabase dashboard's table export for `prescriptions`, `workout_sessions`, and `workout_sets` before destructive maintenance.
- **Delete workout data:** delete only rows owned by the authenticated user, starting with sets and then sessions/prescriptions according to foreign-key rules. A polished in-app flow is not implemented yet.
- **Delete account:** the self-hosting administrator deletes the Authentication user in Supabase after exporting or deleting the user's records. Cascading foreign keys remove that user's connected records.
- **Backup/restore:** use the backup/export tools available for the chosen Supabase plan and test restoration in a separate project before relying on it.

These manual steps are suitable for a self-hosted v0.1 candidate but are a release-readiness limitation. A user-facing export/delete workflow remains Priority A.

