# Architecture

## Core flow

```text
Prescription source
  → Prescription adapter
  → IndexedDB
  → Workout UI
  → local completion
  → Supabase sync
  → validation / duplicate checks
  → optional official-record adapter
```

## Safety boundaries

- **Browser:** publishable Supabase settings only.
- **IndexedDB:** immediate local save and session recovery.
- **Supabase:** authenticated per-user cloud records protected by RLS (row-level security: each user can access only their rows).
- **Optional server gateway:** secret credentials and Google Sheets writes. This code must never run in the browser.
- **Demo:** separate database name, synthetic content, no cloud client, no official-save request.

## Stable identity

`session_id` identifies one performed workout. `set_id` identifies one set and does not change when display numbering changes. This lets the UI renumber remaining sets after deletion without mixing their records.

## Local-first

Local-first means user input is saved on the device before waiting for a network response. Cloud failure must not erase the local completed workout.

