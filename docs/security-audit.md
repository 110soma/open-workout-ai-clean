# Public safety audit

> See [Final independent audit](final-public-audit.md) and its [resolution](blocker-resolution.md). Earlier scanner success did not establish publication readiness; personal metadata and a private-origin identifier were missed.

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

The working tree and all local OSS commits pass their scanners, and the synthetic screenshot was manually reviewed. Run both `npm run audit:public` and `npm run audit:history` again immediately before the first public push. Hosted GitHub checks remain unverified until a repository exists.
