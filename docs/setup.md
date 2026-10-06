# Setup

## 1. Demo only

1. Install Node.js 22 or newer.
2. Download or clone this repository into a new folder.
3. Open a terminal in that folder.
4. Run `npm ci`.
5. Run `npm run dev`.
6. Open the local address shown by Vite.

No account or Secret is required. With no Supabase configuration, Demo mode is automatic.

## 2. Your own Supabase

1. Create a Supabase project.
2. Enable email/password Authentication and create your own user.
3. In SQL Editor, run `supabase/migrations/0001...` through `0005...` in numeric order.
4. Copy `.env.example` to `.env.local`.
5. Set `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_DEMO_MODE=false`.
6. Start the app and sign in.

In a new installation, the app shows an empty menu until a prescription is imported. It does not fetch any private history or plan file. For the first example, follow the next steps.

### Example prescription

This imports a **fictional plan**, not workout actuals, into **your own** Supabase project. No Google Sheets or server secret is needed.

1. In Supabase Authentication → Users, copy your user's UUID (the account identifier).
2. Choose today's date in `YYYY-MM-DD` format.
3. From the repository folder, run this command, replacing both placeholders:

   ```bash
   node scripts/example-prescription-sql.mjs --user-id YOUR_AUTH_USER_UUID --date YYYY-MM-DD
   ```

4. Copy only the generated SQL text into **your own project's SQL Editor** and run it. SQL is a set of database instructions; this one adds or updates one example plan and does not create workout records. Keep your generated output outside Git.
5. In `.env.local`, use `VITE_DEMO_MODE=false`. Leave `VITE_WORKOUT_RECORD_MODE=test` and `VITE_AUTO_FINALIZE=false` while trying the example.
6. Open the app, sign in, and wait for today's menu. Open it and press the start button.

Running the generator again for the same user/date updates the same example ID rather than adding another plan. For real plans, the stored `payload` uses the format in `examples/prescription.example.json`; its target ID/date must agree with the row's ID/date. Importing plans is an administrator operation, never a browser INSERT.

The migration/import flow is tested against an isolated PostgreSQL-compatible engine and the app is browser-tested against a local mock Supabase API. A brand-new external Supabase project remains **not field-tested**.

The publishable key is intended for browser use together with RLS. Do not use the service-role/secret key in the PWA.

`migration` means a numbered SQL file that reproduces the database design. Run `0001` through `0005` once, in order. These files and steps have been reviewed locally, but setup in a brand-new third-party Supabase project is **not yet field-tested**.

Google Sheets is not required. The optional Sheets gateway needs separate server-only credentials; do not add them to `.env.local` or any `VITE_*` variable.

## 3. Checks

- `npm test`: behavior tests
- `npm run build`: TypeScript and production PWA build
- `npm run test:e2e`: synthetic Demo in mobile and desktop browsers
- The same command also checks mock Supabase clean-start, account switching and active-session restoration. Install Chromium once with `npx playwright install chromium` (Windows: `npx.cmd playwright install chromium`).
- `npm run audit:public`: blocks common secrets and private artifacts
- `npm run audit:history`: checks the new local Git history for secrets and private artifacts
