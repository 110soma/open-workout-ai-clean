# v0.1.0 candidate test report

## Private baseline

- Unit: 108 passed, 1 skipped
- TypeScript/Vite/PWA build: passed
- Synthetic Demo E2E: 2 passed (390×844 and 1440×900)

## OSS candidate

- Unit/fixture tests: 53 passed across 13 files
- TypeScript/Vite/PWA build: passed
- Synthetic Demo E2E: 2 passed (390×844 and 1440×900)
- External cloud/API requests during Demo: 0
- Browser JavaScript errors during Demo: 0
- Public safety audit: passed
- npm dependency vulnerability report: 0 known vulnerabilities at install time

The generated JavaScript bundle is about 604 kB before gzip and triggers a size warning. This is a performance improvement item, not a functional failure.

