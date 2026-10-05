# Public safety audit

## Private source risks found

- A real Spreadsheet ID was hard-coded in the optional server adapter.
- Real history and Prescription snapshots were stored under `public/data`.
- Dated repair/import scripts and documentation contained real session identifiers and deployment details.
- Local secret/configuration directories exist but are ignored from Git.
- The current Private folder has no Git repository, so no Private Git history was copied.

## Candidate treatment

- Real Spreadsheet ID replaced by `GOOGLE_SHEETS_SPREADSHEET_ID`.
- Real history/Prescription files not copied.
- Private operational and repair files not copied.
- `.git`, `.env.local`, `.phase4-private`, `.vercel`, build output, and caches not copied.
- A public-safety scanner fails on common secret formats, personal Windows paths, non-example emails, private Supabase URLs, and forbidden artifact paths.

## Release blocker

Run `npm run audit:public` again immediately before creating any public repository. Review binary images manually because text scanners cannot reliably detect personal information inside images.

