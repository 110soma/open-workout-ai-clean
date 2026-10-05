# Data management for self-hosters

## Browser-only Demo

Demo data is stored in the separate `open-workout-ai-demo` IndexedDB database. Users can remove it with the browser's site-data controls. It is never sent to Supabase or the official-save API.

- Chrome/Edge: Developer Tools → Application → Storage → Clear site data.
- iPhone Safari: Settings → Safari → Advanced → Website Data → select the site's domain → Delete.

`IndexedDB` is the browser's built-in local database. Clearing site data removes the local copy, so export or back up important cloud data first.

## Supabase-connected installation

- **Export:** use the Supabase dashboard's table export for `prescriptions`, `workout_sessions`, and `workout_sets` before destructive maintenance.
- **Delete workout data:** delete only rows owned by the authenticated user, starting with sets and then sessions/prescriptions according to foreign-key rules. A polished in-app flow is not implemented yet.
- **Delete account:** the self-hosting administrator deletes the Authentication user in Supabase after exporting or deleting the user's records. Cascading foreign keys remove that user's connected records.
- **Backup/restore:** use the backup/export tools available for the chosen Supabase plan and test restoration in a separate project before relying on it.

These manual steps are acceptable for a self-hosted v0.1 release because the installer controls their own Supabase project. A user-facing export/delete/account-removal screen remains on the post-v0.1 roadmap.

## Backup and restore

1. Export `prescriptions`, `workout_sessions`, and `workout_sets` from your own Supabase project.
2. Keep the files outside the repository and do not commit personal workout data.
3. Test restoration in a separate Supabase project before depending on the backup.
4. Browser-only Demo data has no built-in export in v0.1. Clearing browser data permanently removes it.
