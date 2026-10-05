# Optional Google Sheets adapter

Google Sheets is not required for the core PWA. This adapter is for deployments that need a reviewed official-record workbook.

Server-only variables are listed in `.env.server.example`. The service-account private key and Supabase administrative secret must stay in the server's encrypted environment. `GOOGLE_SHEETS_SPREADSHEET_ID` selects the owner's workbook; no personal Spreadsheet ID is hard-coded.

The current adapter expects the documented tabs and headers used by the staging/commit flow. A future version should provide a workbook template and a schema checker before this optional adapter is advertised as one-click setup.

