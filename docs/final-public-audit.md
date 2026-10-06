# Final independent publication audit

> Historical finding record. See [Blocker resolution](blocker-resolution.md) for the subsequent fixes and current status. This audit's original NO decision is retained for traceability.

Decision: **NO public publication; NO v0.1.0 release yet.**

Scope: candidate working tree and all five reachable commits through `b6f80e6`,
including 144 unique Git blobs, commit metadata, lockfile, SQL, server/client
code, documentation, CI and six raster images. No live database or deployment
was changed. This report supersedes earlier readiness conclusions.

## Publication blockers

1. **Private-origin information in history.** A real prescription identifier
   survived in `tests/validation-duplicate.test.ts`; the working copy is now
   synthetic, but past commits still contain it. Commit author/committer
   metadata also contains a personal email address. Values are deliberately
   omitted here. Do not publish the current history. Rewriting or replacing
   the history requires explicit owner approval and a new complete audit.

2. **Account isolation.** `src/db.ts` uses one connected database for all
   accounts. `src/sync/cloudSync.ts` does not bind local records to an account
   on sign-out/sign-in. `syncPendingWorkouts` selects all pending local records,
   and the gateway assigns the currently signed-in user's ID. A pending
   record from account A can therefore be submitted as account B. Local history
   also remains visible. This is a source-verified dataflow, not a live-account
   experiment. Account-bound local storage and auth-transition regression tests
   are required; merely adding an RLS policy cannot fix this client problem.

3. **Connected clean-start is broken.** `src/App.tsx` awaits
   `seedFromStaticBundle` before enabling the UI/cloud sync. That function
   fetches `/data/history-v1.json`, which is absent from the candidate. The
   prescription loader also falls back to an absent static prescription file.
   Demo bypasses this path, so passing Demo E2E does not establish self-host
   readiness. Connected empty-state startup and an actual example-prescription
   import recipe/test are needed. Do not restore private snapshots to fix this.

4. **Asset redistribution provenance is missing.** The three exercise PNGs
   have no recorded creator/source/redistribution permission. Visual review
   found no obvious personal data, but appearance cannot establish rights.
   Confirm provenance or replace/exclude them before public distribution.
   MIT text and package metadata are consistent; MIT cannot grant rights to
   unverified third-party images.

5. **Optional Sheets authorization boundary.** `api/workout-finalize.mjs`
   authenticates a Supabase user and checks ownership of a session, but has no
   allowed-user check for the single server-configured spreadsheet. If enabled
   with multiple authenticated users, all can submit to that shared destination.
   Keep disabled until a single-owner allowlist or per-user destination boundary
   is enforced and tested. Default-disabled configuration limits exposure but
   does not make the enabled integration safe for arbitrary signups.

## Minimal fix completed locally

The original `workout_sets` foreign key checked only `session_id`, while RLS
checked only the set's `user_id`. An authenticated synthetic user could insert
a set under another user's session. Reproduced in an in-memory PostgreSQL engine.
Migration `0005_set_session_owner.sql` adds a composite owner/session foreign
key. A regression test proves same-owner insertion succeeds and cross-owner
INSERT/UPDATE fail. It was **not applied to any real Supabase project**.

## Checks and limits

- Unit tests: **55 passed**, including the new ownership regression.
- Existing public/history scanners: both pass, despite the privacy findings.
  Their success must not be described as a complete security clearance.
- Independent all-blob scan found no credential value matching the tested
  patterns; lockfile emails were dependency attribution, not application users.
  Automated detection is not proof that no possible secret exists.
- Raster images and screenshot were visually inspected; no visible account,
  email or real workout record was found in the screenshot.
- Lockfile declares permissive licenses plus MPL-2.0; no missing license field
  was found. Package-specific notices/obligations remain applicable. This is
  metadata review, not a legal certification.
- CI uses push/pull_request (not pull_request_target), Node 22, npm ci, Chromium
  E2E, tests, build and the working-tree scanner, with no required secrets.
  It is structurally usable on a public repository, but does not audit complete
  history and does not cover account switching or connected clean-start.
- TypeScript/PWA build and Service Worker generation passed after the fix.
  The existing bundle-size warning remains non-blocking. Previous mobile/desktop
  E2E was not needlessly repeated: this audit changed no UI/runtime client code.
  Hosted CI was not rerun here.
- No credentials were printed, no remote writes were made, and Git history was
  not rewritten. All changes remain local and uncommitted for review.

## Non-blocking follow-up

- Expand the scanners to inspect commit metadata, lockfiles and history in CI.
- Correct account-deletion documentation: the optional commit journal's user
  foreign key has no delete cascade, so deleting an auth user may be blocked.
- Add explicit CI read-only token permissions; improve real offline/service
  worker and arbitrary-external-request coverage. Current E2E starts with an
  already-active Demo, not the complete planned-to-start flow.
- README, LICENSE, CONTRIBUTING, SECURITY, CHANGELOG, issue templates, setup,
  examples, tests, CI and candidate release notes exist. The README explains
  the concept/Demo, but cloud claims must remain qualified until blockers close.

## Codex for Open Source

Technical application preparation: **NOT READY** until the blockers close and
an approved public repository URL exists. The official application asks for a
public GitHub profile/repository, maintainer role and real usage/ecosystem
context; no guaranteed acceptance or fixed star threshold is stated.
A v0.1.0 release is our project milestone, not a claimed mandatory program rule.
Use only actual users/issues/releases; retain unknown figures as TBD.
Official source: https://openai.com/form/codex-for-oss/
