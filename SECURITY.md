# Security policy

## Supported version

The upcoming v0.1.x line will receive security fixes.

## Reporting

Do not publish secrets, access tokens, real workout records, or account details in an issue. Until a public security contact is selected, report privately to the maintainer through the repository host's private vulnerability-reporting feature.

## Trust boundaries

- `VITE_*` values are public browser configuration; never place service-role or secret keys there.
- Supabase row-level security limits each user to their own rows.
- Google Sheets integration is optional and server-only.
- Demo mode uses a separate IndexedDB database and does not call cloud or official-save endpoints.
