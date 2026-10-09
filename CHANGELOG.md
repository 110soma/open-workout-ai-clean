# Changelog

## [0.1.1] - 2026-10-09

- Redesigned the rest timer with a bottom-open 270-degree arc, a smoothly moving endpoint light, and spacious italic digits.
- Kept full-screen completion feedback as a single three-second glow with reduced-motion support.
- Improved next-set details, rep-range spacing and the plus/minus 15-second controls without changing timing or persistence.
- Added Windows beginner setup and troubleshooting guides in Japanese.
- Added timer presentation regression tests and separated synthetic PR merge metadata from publishable-history auditing.
- No database migration or credential changes are required for this update.

## [Unreleased]

- Confirmed the private GitHub repository and hosted CI before any public release.
- Isolated connected local databases by account and project, with safe remounts and upload-owner checks.
- Removed missing private-snapshot dependencies and documented a credential-free example-plan SQL generator.
- Replaced unverified exercise images with an original MIT geometric placeholder.
- Restricted the experimental Sheets gateway/readiness endpoint to one configured authenticated owner.
- Added same-owner set/session enforcement, regression tests, and full-history privacy checks including commit metadata.

## [0.1.0-rc.1] - 2026-10-06

- Prepared a private v0.1.0 candidate from the validated local-first workout PWA.
- Added a no-cloud Demo mode with synthetic data.
- Made Supabase setup reproducible through migrations.
- Made Google Sheets an optional server-only adapter.
- Added public-safety checks and CI configuration.
- Finalized the Open Workout AI name and MIT License.
