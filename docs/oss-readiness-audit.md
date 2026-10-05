# OSS readiness audit

## Completed in the private application

PWA, IndexedDB local-first storage, prescription conversion, stable sessions/sets, set input, optional RIR, rest timer, offline recovery, Supabase sync, cloud restore, staging/validation/duplicate/master checks, idempotent commit journal, history, exercise list/details, and Preview deployment.

## Reused in this candidate

React/Vite/TypeScript/PWA, IndexedDB model, Workout UI, prescription adapter, session recovery, Supabase client and migrations, validation modules, Demo mode, and focused tests.

## Generalized

- Brand and IndexedDB names
- Demo as safe no-configuration default
- Spreadsheet ID moved from source code to server-only configuration
- Private deployment and Windows Credential Manager scripts removed
- Real static history/Prescription removed
- Google Sheets documented as optional

## Not copied

Private `.env*`, `.phase4-private`, `.vercel`, real history JSON, real Prescription JSON, manual workout imports, dated repair scripts/tests/docs, personal deployment tools, and Git history.

## Remaining before public release

1. Approve project name and license.
2. Add one reviewed synthetic screenshot.
3. Verify setup in a clean directory/machine.
4. Add user-controlled data export and account/data deletion guidance.
5. Run one final secret/history scan, then create a new repository with a fresh Git history.

