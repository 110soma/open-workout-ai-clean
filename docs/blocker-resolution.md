# Public blocker fixes

Scope: independent OSS candidate and its Private GitHub repository only.
The live workout app, deployments, actual Supabase/Sheets and credentials were
not changed. No public publication or release was performed.

## Checkpoint and history

Before rewriting, local/remote main and the latest successful hosted CI were
verified. The original complete Git history, HEAD archive, uncommitted patch
and three untracked audit/fix files were preserved inside
`.git/oss-safety/before-blocker-fixes/`. The Git bundle was verified readable.
This directory is excluded from every commit and push and must remain private.

The five original commits were recreated with generic contributor metadata.
The private-origin plan identifier and the three unverified exercise images
were removed from all their trees. Subsequent commits use the same generic
identity. A force-with-lease update of Private main is allowed only after
local verification; the lease protects against unexpectedly changed remote main.

The new scanner checks all reachable commit metadata and blobs, binary/UTF-16
content, lockfile secret patterns and every historical filename. It rejects
shallow or unreadable history rather than declaring success. CI fetches the
complete history and runs this scanner alongside the working-file scanner.

Git rewriting controls reachable publishable history; it does **not** guarantee
that the hosting provider has erased old unreferenced objects or cached views.
Provider-retained old objects must be reviewed before Public visibility.

## Account isolation

Each project/account has its own IndexedDB, with an explicit owner marker.
Signed-out screens never mount workout/history views. Auth changes hide the
current account and fully reload the app, so stale component state is not
reused. Logout waits for queued local saves. Uploads and official-save requests
check the bound owner against the current session; a mismatch stops submission.
Existing account databases are retained for subsequent logins. Old unowned
candidate data is quarantined, not deleted or assigned to a new user.

Tests cover A active/pending data, logout, B empty display/no A uploads, return
to A with recovery, project isolation, and a tampered owner marker. Browser
tests exercise real app login transitions against local mock responses.

## Self-host startup

No bundled private history or prescription file is requested. A new account
opens empty and retrieves plans through its own cloud account. A SQL generator
produces a fictional, date/account-bound example plan with no secrets or
network activity. The setup guide explains how to import it in one's own SQL
Editor. Repeat import updates the same example instead of duplicating it.

All five migrations and the generated SQL are tested against an isolated
PostgreSQL-compatible engine, including RLS read visibility and zero generated
workout actuals. Real third-party Supabase setup remains **not field-tested**.

## Images

Three inherited PNGs were removed from the working tree and all publishable
history. A geometric SVG authored for this repository replaces them under MIT.
No external images were obtained. The original private assets remain only in
the local recovery checkpoint.

## Optional Sheets

The gateway remains disabled by default and experimental. It now permits
exactly one configured server-side `WORKOUT_SHEETS_OWNER_USER_ID`, authenticated
from the bearer token. Missing, malformed, multiple or mismatched owner IDs stop
before cloud/Sheets reads and writes. The readiness endpoint has the same
boundary. No user-supplied body field can bypass it.

## Verification

- Unit suite includes owner/set foreign-key protection, auth isolation,
  example import, gateway denial and audit regression checks.
- Mobile 390×844 and desktop 1440×900 browser checks cover no-cloud Demo,
  connected clean-start, plan/start, active reload, account switching and
  pending upload ownership. Supabase responses are mocked locally.
- TypeScript/Vite/PWA build succeeds and generates the Service Worker.
- Dependency audit reported zero known vulnerabilities during this work.
- Working files and complete publishable history are audited before the remote
  history update. Hosted CI results must be checked for the exact pushed main.

## Recovery and remaining scope

Recover the old private history by cloning `original-history.bundle` into an
isolated recovery folder and applying the saved patch/copying saved untracked
files. Never publish that restored copy. The daily-use app needs no rollback
because it was not modified.

Remaining: independent re-audit, provider-retained history review, maintainer
approval for Public visibility and a separate approval for v0.1.0 release.
No AI/progression/history UI expansion is part of these fixes.
