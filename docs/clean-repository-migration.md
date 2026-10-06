# Clean repository migration

The canonical OSS candidate is now the independent **Private** repository
`110soma/open-workout-ai-clean`. This was created empty, not as a fork, and
received only the audited `main` history. No tags, backup branches, old remote
refs, reflogs, local safety files or credentials were transferred.

The previous `110soma/open-workout-ai` repository remains Private and unchanged.
It is an archive, **not a candidate for Public visibility**: old unreferenced
objects can still be retrieved there. The earlier publication-blocker reports
describe that archive and must not be mistaken for the new repository's status.

## Checks

- Before transfer, working tree was clean at the verified source commit.
- Current-file audit and all eight source commits passed the history audit.
- The new repository exposes only `main` and no tags.
- All five pre-cleanup commit IDs were checked against both GitHub's commit API
  and Git-object API for the new repository. The commit API reported no commit
  found (HTTP 422); the object API returned HTTP 404. None was retrievable.
- A fresh authenticated clone contains only the new repository's refs, with no
  safety folder or credentials from the source clone.
- Tests use fictional data and local mock Supabase responses, not live services.
- From the new repository's fresh clone, `npm ci` and `npm run verify` passed:
  68 unit tests, four browser tests (390×844 and 1440×900), TypeScript/Vite build,
  PWA Service Worker generation, current-file audit and full history audit.
  `npm audit --json` reported zero known vulnerabilities. Demo testing requires
  no Supabase configuration and checks that no external data is sent.
- Hosted checks require no repository secrets. See the latest GitHub Actions run
  for the exact current commit, rather than relying on a prior repository's run.

These checks do not claim that the old archive was erased; it was not. Keeping
it Private is essential. No Public visibility change or release was performed.

## Local operation and recovery

The OSS working folder's `origin` points to the clean repository. The old remote
is retained locally as `legacy-private`; never push to it for future OSS work.
Only explicitly selected `main` was pushed, not a mirror of local refs.

The original pre-cleanup bundle and saved local changes remain in the source
clone's private `.git/oss-safety/before-blocker-fixes/` folder. This backup must
never be published or copied into the clean repository. The daily-use app,
deployments, live databases, Sheets and Credential Manager were not modified.

Next: independent final audit, then separate maintainer approvals for Public
visibility and the v0.1.0 release. A new external Supabase installation remains
not field-tested; local mock/database checks do not claim otherwise.
