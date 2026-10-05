# v0.1.0 candidate test report

## Private baseline

- Unit: 108 passed, 1 skipped
- TypeScript/Vite/PWA build: passed
- Synthetic Demo E2E: 2 passed (390×844 and 1440×900)

## OSS candidate

- Unit/fixture tests: 54 passed across 14 files
- TypeScript/Vite/PWA build: passed
- Synthetic Demo E2E: 2 passed (390×844 and 1440×900)
- External cloud/API requests during Demo: 0
- Browser JavaScript errors during Demo: 0
- Public safety audit: passed
- npm dependency vulnerability report: 0 known vulnerabilities at install time
- Fresh local clone: dependency install, Demo dev server, Unit, Build, E2E, public audit, and Git-history audit passed
- Demo development server: HTTP 200
- PWA output: manifest and generated Service Worker confirmed
- Git history audit: 2 local commits passed with no secret values printed

The clean setup used a new local clone with no `.env.local` and no reused `node_modules`. This is a strong first-install simulation, but not a separate physical computer test. The generated JavaScript bundle is about 604 kB before gzip and triggers a size warning. This is a performance improvement item, not a functional failure.
