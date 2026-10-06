# Public readiness report — v0.1.0-rc.1

## Technical status

The release candidate is stored in a Private GitHub Repository. Demo install, Workout execution, local recovery, build, PWA generation, mobile/desktop E2E, dependency audit, tracked-file audit, Git-history audit, and hosted GitHub Actions pass.

See [Blocker resolution](blocker-resolution.md) for the subsequent security fixes, verification scope and remaining publication checks. A passing scanner alone is not an independent security approval.

**Current publication decision: NO.** Clean reachable history and local checks pass, but GitHub still serves old private-origin objects by their old commit IDs. Keep this existing repository Private until that retention is resolved or an approved clean repository replaces it.

## External actions intentionally not performed

- Public push or visibility change
- Public v0.1.0 Release
- Production deployment
- New external Supabase project

## Required before public release

1. Repeat public and history audits immediately before changing visibility.
2. Independently re-audit the blocker fixes and review any old objects retained by the hosting provider.
3. Maintainer approves Public visibility.
4. Maintainer separately approves the v0.1.0 Release.

## Non-blocking limitations

- UI is primarily Japanese.
- The main bundle has a size warning.
- A fresh external Supabase setup has not been field-tested.
- Data export/deletion is administrator-run, not an in-app workflow.
