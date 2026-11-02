# Changelog

## 0.1.0 (2026-10-27)

- Initial release: `check_pr_issue_link` MCP tool and
  `check` CLI command verifying that a PR addresses the
  issue it claims to close.
- Pinned closing keywords — close, closes, closed, fix,
  fixes, fixed, resolve, resolves, resolved —
  case-insensitive and whole-word, followed by optional
  whitespace and a whole-token `#<issue_number>`
  reference, scanned in the PR body first and then in
  each commit message in order.
- Pinned term extraction: issue-title tokens split on
  runs outside [a-z0-9], shorter than 3 characters or in
  the pinned stopword list dropped, matched against
  changed-file tokens the same way.
- Four pinned verdicts — `linked`, `weak`,
  `mentioned_only`, and `unlinked` — combining the
  closing-reference signal with the matched-term signal.
- Path-naming validation errors for malformed input,
  with no partial results.
