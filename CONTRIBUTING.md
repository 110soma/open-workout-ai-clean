# Contributing

1. Discuss substantial changes in an issue first.
2. Never include real workout history, credentials, private URLs, or personal identifiers.
3. Run `npm run verify` before opening a pull request.
4. Add or update a focused test for behavior changes.
5. Keep local-first safety: user input must be stored locally before network work begins.
6. Use GitHub's private noreply commit email (GitHub Settings → Emails) rather than a personal email. The history audit checks author/committer metadata as well as files.

Enable **Keep my email addresses private** and **Block command line pushes that expose my email** in GitHub Settings → Emails. For local commits, configure this repository's `user.email` with the exact GitHub-provided noreply address; changing the website setting does not change existing commits or local Git configuration.

PR CI tests GitHub's temporary merge tree and scans its current files. A separate full-history checkout of the PR head audits all real branches and tags, including every commit's metadata and past file contents. Only GitHub-generated temporary merge metadata is outside that history checkout; the audit rules are not relaxed. Actual merge commits added to a branch remain subject to the full audit. Before merging, use a private noreply identity and confirm the resulting commit passes CI.

The repository is public and v0.1.0 is released. CI is active. Submit changes through a pull request; release and deployment decisions remain with the maintainer.
