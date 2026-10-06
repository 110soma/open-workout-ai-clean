# v0.1.0 release candidate notes

## Available

Local-first workout execution from a prescription, stable sessions/sets, offline-safe input, rest timer, active/completed recovery, optional RIR, Supabase sync/restore, synthetic no-cloud Demo mode, PWA build, and core validation/de-duplication modules.

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
