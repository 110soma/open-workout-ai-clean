# Open Workout AI v0.1.1

A small rest-timer and documentation update. Workout recording, timing, recovery and synchronization behavior remain unchanged.

## What's new

- A bottom-open 270-degree progress arc with a smoothly moving light point.
- Larger, spacious italic time digits and clearer next-set weight and rep ranges.
- Rest completion uses one full-screen three-second glow, not repeated flashing. Reduced-motion preferences are respected.
- Redesigned plus/minus 15-second buttons; their behavior is unchanged.
- Japanese Windows beginner guides cover Demo, your own Supabase setup and troubleshooting.
- Additional mobile and desktop regression coverage, and accurate auditing of publishable Git history in pull-request CI.

## Try it

Download the source archive and follow the [README](https://github.com/110soma/open-workout-ai-clean#readme) and [setup guide](https://github.com/110soma/open-workout-ai-clean/blob/v0.1.1/docs/setup.md).

With Node.js 22 or newer, run `npm ci` then `npm run dev`. On Windows PowerShell use `npm.cmd ci` and `npm.cmd run dev`. Open the URL shown in PowerShell.

Without Supabase settings, Demo uses fictional data stored locally and makes no external cloud or official-record requests. Optional Supabase connection uses your own project and authenticated account. Keep `VITE_WORKOUT_RECORD_MODE=test` and `VITE_AUTO_FINALIZE=false` during setup.

## Upgrade

No new migrations or environment variables are required. Existing installations still require migrations through `0005`. Preserve your untracked `.env.local`, stop the local server, replace the source with this version, run `npm ci`, and restart. Do not delete browser storage when upgrading; local records are stored there. Published v0.1.0 remains unchanged.

## Known limitations and security

- Interface text is mostly Japanese; the browser bundle still exceeds the preferred size warning threshold.
- The maintainer has reported successful setup on a new Supabase project with assistance. Independent third-party setup using a new real Supabase project has not been field-tested.
- Google Sheets integration is optional, experimental, disabled by default and limited to one explicitly configured account. It is not part of the basic setup.
- No AI-generated plans, formal progression/PR features or in-app export/deletion UI are added.
- Use only publishable keys in `VITE_*`; keep administrative and Google credentials server-only.

No deployment of the maintainer's personal application or changes to real workout databases are included. This release contains source archives only, with no manually uploaded binaries or credentials.
