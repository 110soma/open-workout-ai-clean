# Optional Google Sheets adapter

Google Sheets is not required for the core PWA. In v0.1, this is an **experimental single-owner self-host feature**, disabled by default. It is not a shared-workbook multi-user service.

Server-only variables are listed in `.env.server.example`. The service-account private key and Supabase administrative secret must stay in the server's encrypted environment. `GOOGLE_SHEETS_SPREADSHEET_ID` selects the owner's workbook; no personal Spreadsheet ID is hard-coded.

Set `WORKOUT_SHEETS_OWNER_USER_ID` to exactly one permitted Supabase Authentication user UUID on the server. Both finalization and readiness endpoints reject other authenticated users before any Sheets operation. Missing, malformed or multiple owner IDs fail closed (no submission). The owner is taken from the validated login token, never from a request body's claimed user ID. Keep `WORKOUT_AUTO_FINALIZE_ENABLED=false` until the owner, workbook schema and server setup have been reviewed. Browser secrets are prohibited.

The current adapter expects the documented tabs and headers used by the staging/commit flow. A future version should provide a workbook template and a schema checker before this optional adapter is advertised as one-click setup.
