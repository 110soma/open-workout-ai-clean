# Clean setup report — 2026-10-06

## Result

**PASS in a fresh local clone.**

The clone contained no `.env.local` and did not reuse the candidate folder's `node_modules`. The documented Demo setup worked without Supabase or Google Sheets.

## Verified

- `npm ci`: passed; 0 known vulnerabilities
- `npm run dev`: started; Demo URL returned HTTP 200
- Unit/fixture tests: 54 passed
- Production PWA build: passed
- Service Worker and web manifest: generated
- E2E: 2 passed at 390×844 and 1440×900
- Active-session reload: passed
- Weight/reps input and set completion: passed
- Completed-session reload: passed
- External cloud/official-save requests in Demo: 0
- Browser JavaScript errors: 0
- Working-tree and Git-history safety audits: passed

## Verification boundary

This was a new local clone on the maintainer's computer, not a separate physical computer. A brand-new third-party Supabase project was not created, so that external setup remains explicitly unverified.
