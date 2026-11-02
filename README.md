# linkedcheck

A pull request that says "fixes #123" in its description
has made a claim, not a proof. The files it touches might
have nothing to do with the issue at all, and a reviewer
skimming a long queue has no quick way to tell a genuine
link from a hopeful one. linkedcheck checks the claim
against two independent signals: the words of the PR
itself, and the scope of its diff.

The first signal is linkage in the text. The PR body is
scanned first, then each commit message in order, for a
closing reference: one of the closing keywords `close`,
`closes`, `closed`, `fix`, `fixes`, `fixed`, `resolve`,
`resolves`, or `resolved` — case-insensitive, as a whole
word — followed by optional whitespace and `#<issue_number>`.
The number must match as a whole token, so `#12` is not a
reference to issue 123 and `#1234` is not either. Any bare
`#<issue_number>` occurrence, keyword or not, counts as a
mention, and a closing reference always counts as one too.

The second signal is scope. The issue title is lowercased
and split on runs of characters outside `[a-z0-9]`; tokens
shorter than three characters and a fixed list of stopwords
(`the`, `a`, `an`, `in`, `on`, `of`, `for`, `to`, `when`,
`with`, `and`, `or`, `is`, `are`, `be`, `by`, `at`, `as`,
`it`, `this`, `that`) are dropped. What remains are the
title's terms. Each changed file path is tokenised the same
way, and `matched_terms` is the sorted list of terms that
also appear as file tokens — so an issue about a login
redirect matching `src/login/redirect.ts` is real overlap,
not a coincidence of prose.

The two signals combine into one verdict:

- **`linked`** — a closing reference exists and at least
  one term matches.
- **`weak`** — a closing reference exists but no term
  matches: claimed, with no scope evidence behind it.
- **`mentioned_only`** — the issue is mentioned but no
  closing keyword claims it.
- **`unlinked`** — neither a closing reference nor a
  mention.

Malformed input — a missing or non-string `pr_body`, an
`issue_number` that is not an integer of at least 1, a
missing, empty, or non-string `issue_title`, a
`changed_files` list that is missing, not an array, or
holding a non-string or empty entry, or a
`commit_messages` value that is not an array of strings —
is a validation error naming the offending path, with no
partial result. The computation is pure and local: no
network, no configuration, and no repository is read —
linkedcheck only checks the texts and paths you hand it.

## CLI

```bash
npx @reneturcios/linkedcheck check --input args.json
npx @reneturcios/linkedcheck --version
```

`args.json` contains the full arguments object:

```json
{
  "pr_body": "Fixes #123",
  "issue_number": 123,
  "issue_title": "Fix login redirect loop",
  "changed_files": ["src/login/redirect.ts"],
  "commit_messages": []
}
```

The result is printed as JSON:

```json
{
  "verdict": "linked",
  "closing_reference": true,
  "mentioned": true,
  "matched_terms": ["login", "redirect"],
  "term_count": 4
}
```

Exit codes: `0` on success, `1` on a runtime error (including
an unreadable or invalid input file, or invalid input), `2`
on a usage error.

## MCP server

```bash
npx -y @reneturcios/linkedcheck mcp
```

MCP client config:

```json
{
  "mcpServers": {
    "linkedcheck": {
      "command": "npx",
      "args": ["-y", "@reneturcios/linkedcheck", "mcp"]
    }
  }
}
```

### Tools

- `check_pr_issue_link` — Verify that a pull request
  actually addresses the issue it claims to close.
  - `pr_body` (string, required, may be empty) — pull
    request body text
  - `issue_number` (integer, required, at least 1) —
    number of the issue the PR claims to close
  - `issue_title` (string, required, non-empty) — title
    of the issue the PR claims to close
  - `changed_files` (array of strings, required, may be
    empty) — paths of the files the PR changes
  - `commit_messages` (array of strings, optional,
    default `[]`) — commit messages of the PR

  Returns `{verdict, closing_reference, mentioned,
  matched_terms, term_count}`, where `term_count` is the
  number of distinct issue-title terms and
  `matched_terms` is the sorted subset of them found in
  the changed files.

## Docker

```bash
docker run -i ghcr.io/cloudcorprecords/linkedcheck
docker run --rm -v "$PWD:/w" ghcr.io/cloudcorprecords/linkedcheck check --input /w/args.json
```

## Development

```bash
npm install
npm run build   # tsc -> dist/
npm test        # tsx --test test/*.test.ts (pure local, no network)
npm run dev     # run the CLI from source
```

## License

MIT — Copyright (c) 2026 Rene Turcios
