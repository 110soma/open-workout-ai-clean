# Setup

## 1. Demo only

1. Install Node.js 22 or newer.
2. Run `npm ci`.
3. Run `npm run dev`.
4. Open the local address shown by Vite.

No account or Secret is required. With no Supabase configuration, Demo mode is automatic.

## 2. Your own Supabase

1. Create a Supabase project.
2. Enable email/password Authentication and create your own user.
3. In SQL Editor, run `supabase/migrations/0001...` through `0004...` in numeric order.
4. Copy `.env.example` to `.env.local`.
5. Set `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_DEMO_MODE=false`.
6. Start the app and sign in.

The publishable key is intended for browser use together with RLS. Do not use the service-role/secret key in the PWA.

## 3. Checks

- `npm test`: behavior tests
- `npm run build`: TypeScript and production PWA build
- `npm run test:e2e`: synthetic Demo in mobile and desktop browsers
- `npm run audit:public`: blocks common secrets and private artifacts

