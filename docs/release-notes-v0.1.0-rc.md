# Open Workout AI v0.1.0 — Release Notes draft

This is the prepared text for the first release. No release or tag has been created yet.

Open Workout AI is a local-first workout execution and logging PWA: bring a prescription, perform the workout, preserve progress on the device, and optionally synchronize completed records to your own Supabase project.

## Available

- Prescription loading and conversion into a workout with stable session/set IDs.
- Weight, reps and optional RIR input, set addition/deletion and a rest timer.
- Immediate IndexedDB saves, active-session recovery after reload, and completed-session recovery.
- Local input during temporary offline use and synchronization after reconnecting.
- Optional Supabase authentication, account/project-isolated local storage and completed-workout cloud sync/restore.
- Validation and duplicate-protection modules, with an optional server-side official-record adapter.
- Installable PWA with synthetic Demo mode and MIT-licensed source code.

## Try Demo mode

With Node.js 22 or newer installed, obtain the source and run:

```bash
npm ci
npm run dev
```

On Windows PowerShell, use `npm.cmd ci` and `npm.cmd run dev`.

Open the local URL shown in the terminal. No Supabase account or Google Sheets setup is required. Without Supabase settings the app starts in Demo mode, uses fictional records in a separate IndexedDB database, and sends no cloud or official-save requests.

Demo mode has been verified at 390×844 and 1440×900, including local recovery, completion, and no external requests.

## Setup with your own Supabase

Create your own Supabase project and Authentication user, apply migrations `0001` through `0005` in order, copy `.env.example` to `.env.local`, and set the Project URL and publishable key. Set `VITE_DEMO_MODE=false`, import an example prescription using the documented SQL generator, and sign in. Keep test record mode and automatic finalization disabled while trying the example.

Follow the [setup guide](https://github.com/110soma/open-workout-ai-clean/blob/main/docs/setup.md). Connected startup, ownership rules and example import are tested with local mocks and an isolated database engine. **A third party's first installation using a new real Supabase project has not been field-tested.**

## Optional Google Sheets integration

Google Sheets is **optional and experimental**, disabled by default, and unnecessary for Demo or core Supabase operation. The server gateway permits exactly one configured account and requires server-only credentials plus a compatible workbook schema. Missing or mismatched owner configuration stops submission. A one-click workbook setup is not included.

## Not yet available

One-click optional Sheets template setup, in-app data export/deletion UI, formal PR/progression, AI feedback, AI-generated plans, and full localization.

## Known issues

- User interface text is mostly Japanese.
- The main browser bundle is larger than the preferred warning threshold.
- Optional Sheets gateway requires a compatible workbook schema.
- The optional Sheets gateway is experimental and permits only one explicitly configured account.
- Setup in a brand-new third-party Supabase project has not yet been field-tested.

## Security notes

Use only a Supabase publishable key in `VITE_*`. Keep administrative and Google credentials server-only. Demo mode does not send workout data.

## Upgrade notes

This is the first candidate. No prior public schema is supported.

Apply migrations through `0005` for matching set/session ownership. This candidate now partitions local storage by account/project; older unowned local databases are left untouched and never auto-imported. The publishable Git history was sanitized before public release; existing private clones need a fresh clone after the authorized history update.
