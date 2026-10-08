# Security policy

## Supported version

The released v0.1.x line will receive security fixes.

## Reporting

Do not publish secrets, access tokens, real workout records, or account details in an issue.

This repository is public. GitHub private vulnerability reporting is enabled. No alternative public contact is configured.

Once that feature is enabled, use **Security → Report a vulnerability** on GitHub to send a private report. If that option is absent, the reporting channel is not available yet; do not post sensitive details in a public issue.

## Trust boundaries

- `VITE_*` values are public browser configuration; never place service-role or secret keys there.
- Supabase row-level security limits each user to their own rows.
- Google Sheets integration is optional and server-only.
- Demo mode uses a separate IndexedDB database and does not call cloud or official-save endpoints.
