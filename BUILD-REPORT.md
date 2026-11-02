# linkedcheck — Build Report

MCP Rebuild 1000, Batch 17. Original program build from the
packages-100 plan (cluster A #8), built from the spec in
`~/workspace/mcp-rebuild-100/specs-batch17/linkedcheck.md`
(read first). There is no external original; the tool surface
is the program's defined spec. Local build only — nothing
pushed or published.

Identity: repo `linkedcheck`, npm `@reneturcios/linkedcheck`,
MCP name `io.github.CloudCorpRecords/linkedcheck`, version
`0.1.0`, bin `linkedcheck` → `dist/cli.js`.

## Files created (19/19 per TEMPLATE.md checklist)

- `package.json`, `server.json` (description "Verify a PR
  really addresses the issue it claims to close: closing
  keywords plus diff scope." — 92 chars, verified by count;
  npm entry carries `version: 0.1.0`; OCI entry
  `ghcr.io/cloudcorprecords/linkedcheck:0.1.0` carries **no**
  `version` field), `Dockerfile` (node:20-alpine two-stage,
  label
  `io.modelcontextprotocol.server.name="io.github.CloudCorpRecords/linkedcheck"`),
  `tsconfig.json`, `.gitignore`, `LICENSE` (MIT, Copyright
  (c) 2026 Rene Turcios), `README.md` (fresh text),
  `CHANGELOG.md` (single 0.1.0 entry, 2026-10-27),
  `package-lock.json` (Route 3, see below)
- `src/index.ts`, `src/cli.ts` (`check --input <args.json>`
  where the file holds the full arguments object, `mcp`,
  `--version`; exit 2 usage / 1 runtime error, argument
  validation before any file read), `src/mcp.ts`,
  `src/types.ts`, `src/linkedcheck.ts` (core,
  `VERSION = "0.1.0"`, also exporting the pinned helpers
  `tokenize`, `issueTerms`, and `changedFileTokens`)
- `test/linkedcheck.test.ts`
- `.github/workflows/{ci,publish,publish-container,registry-publish}.yml`
  (publish-container `IMAGE = ghcr.io/cloudcorprecords/linkedcheck`,
  smoke-test server-name assertion `linkedcheck`)

Plus the parity fixture at
`harness/fixtures/linkedcheck-tools-original.json`, labelled
as a program spec from the packages-100 plan cluster A #8.

## Tools implemented (1)

- `check_pr_issue_link` — arguments: `pr_body` (string,
  required, may be empty), `issue_number` (integer, required,
  >= 1), `issue_title` (string, required, non-empty),
  `changed_files` (array of strings, required, may be empty,
  entries non-empty), and `commit_messages` (array of
  strings, optional, default []).

  Closing keywords are pinned (case-insensitive, whole
  word): close, closes, closed, fix, fixes, fixed, resolve,
  resolves, resolved. A closing reference is a closing
  keyword followed by optional whitespace and then
  `#<issue_number>`, the number as a whole token (`#12`
  does not match issue 123, `#1234` does not match issue
  123). Texts scanned: `pr_body` first, then each commit
  message in input order. A mention is any whole-token
  `#<issue_number>` occurrence in the scanned texts; a
  closing reference implies a mention.

  Issue-title terms are pinned: lowercase the title, split
  on maximal runs of characters outside [a-z0-9], drop
  tokens shorter than 3 characters and drop the pinned
  stopwords (the, a, an, in, on, of, for, to, when, with,
  and, or, is, are, be, by, at, as, it, this, that); the
  remaining distinct tokens are the terms and `term_count`
  is their number. Changed-file tokens are collected the
  same way across all paths, and `matched_terms` is the
  terms among them, sorted ascending.

  The verdict is pinned: "linked" (closing reference and
  at least one matched term), "weak" (closing reference
  and no matched term), "mentioned_only" (no closing
  reference but a mention), "unlinked" (neither). Returns
  `{verdict, closing_reference, mentioned, matched_terms,
  term_count}`.

  The fixture literal
  (`harness/fixtures/linkedcheck-tools-original.json`) and
  the `src/mcp.ts` literal are identical, with no `$schema`
  and no `additionalProperties` — confirmed by the parity
  run below.

## Implementation notes

- `src/mcp.ts` uses the SDK's low-level `Server` with an
  explicit inputSchema literal exactly matching the
  fixture, per the standing fleet rule (no McpServer/zod
  schema conversion). Every `tools/call` is validated by
  the core itself, so the MCP and CLI paths share one
  validation implementation; the core takes the full
  arguments object (`{pr_body, issue_number, issue_title,
  changed_files, commit_messages?}`).
- Validation is path-naming and total: a missing or
  non-string `pr_body`; a missing `issue_number` or one
  that is not an integer >= 1; a missing, empty, or
  non-string `issue_title`; a missing or non-array
  `changed_files`, or one holding a non-string or empty
  entry (the error names the entry's index); or a
  `commit_messages` present but not an array of strings
  (again index-naming) throws an Error naming the
  offending path and produces no partial result (MCP:
  `isError`; CLI: exit 1). Field validation runs in the
  spec's field order: `pr_body`, `issue_number`,
  `issue_title`, `changed_files`, `commit_messages`.
- Whole-token number matching is implemented with a
  trailing `(?![0-9])` lookahead on the exact issue
  number, so prefix and longer-number collisions both
  fail, while `#123` followed by punctuation still
  matches. Closing keywords are matched with `\b` on
  both sides, so a keyword embedded in a longer word
  (`prefixes`, `fixedly`) is not a closing keyword.

## Verification (foreground, this session)

- `npm test` (`tsx --test test/*.test.ts`): **53 tests,
  53 pass, 0 fail** — every pinned closing keyword
  forming a closing reference; case-insensitivity;
  keywords embedded in longer words rejected; optional
  and flexible whitespace (including zero whitespace,
  tab, and newline); punctuation between keyword and
  reference breaking the closing link while keeping the
  mention; a closing reference to a different issue
  counting as neither; closing references in commit
  messages; bare mentions in body and commits; the
  whole-token boundaries (`#12` vs issue 123, `#1234` vs
  issue 123, issue 12 vs `#123`, punctuation-terminated
  matches); a closing reference implying a mention; term
  extraction (distinct lowercased tokens, every pinned
  stopword dropped, tokens shorter than 3 dropped with
  length 3 kept, punctuation splitting, digit terms);
  file-token matching (directories, stems, extensions,
  case-insensitivity, punctuation splitting, substring
  non-matching, sorted matched terms, duplicates across
  files reported once); all four verdicts with exact
  result objects; boundary cases (empty `pr_body`,
  empty `pr_body` linked by a commit, empty
  `changed_files`, omitted and empty-string commit
  messages, issue number 1); and every validation path
  (missing/non-string `pr_body`, missing and malformed
  `issue_number`, missing/empty/non-string
  `issue_title`, missing/non-array `changed_files` with
  index-named bad entries, malformed `commit_messages`
  with index-named bad entries, unknown extra fields
  ignored, non-object top-level treated as {}, and no
  partial result on invalid input).
- `npx tsc --noEmit` → exit 0; `npm run build` produced
  `dist/` with all 15 outputs.
- `dist/cli.js --version` → `0.1.0`; unknown command exits
  2 with usage; `check` with no `--input` exits 2;
  `check --input <missing file>` exits 1 naming the file;
  `check --input <valid file>` exits 0 and prints
  `{"verdict": "linked", "closing_reference": true,
  "mentioned": true, "matched_terms": ["login",
  "redirect"], "term_count": 4}` for the hand-checked
  input `{"pr_body": "Fixes #123", "issue_number": 123,
  "issue_title": "Fix login redirect loop",
  "changed_files": ["src/login/redirect.ts"],
  "commit_messages": []}`; `check --input <invalid file>`
  (issue_number 0) exits 1 with `issue_number must be an
  integer >= 1`.
- Parity: `harness/parity.py` vs
  `harness/fixtures/linkedcheck-tools-original.json` →
  **PASS, parity 100.0, identical_tools 1/1** (run with
  the rebuild path as an absolute path; the harness does
  not expand a `~` inside the quoted stdio command
  string). Report saved under `parity-out/`.

## Lockfile status

`package-lock.json` generated clean via Route 3 (in the
build directory with no `node_modules` present, offline
`npm install --package-lock-only --ignore-scripts
--offline`), verified: parses, name
`@reneturcios/linkedcheck`, **128 package entries**.
Resolved versions match the sibling reference tree
(`@modelcontextprotocol/sdk` 1.32.2, `zod` 3.25.76,
`tsx` 4.23.15, `typescript` 5.9.3, `@types/node`
20.19.43, `qs` 6.17.0). The subsequent offline
`npm install --ignore-scripts --offline`, build, tests,
and parity all ran against this lockfile's tree. (One
mid-session service restart interrupted the first
install and left a truncated dependency file behind;
`node_modules` was removed and reinstalled cleanly from
the lockfile before the verification runs above.)

## Gaps / honest notes

- **Pinned judgement calls** (each with a dedicated
  test where applicable): (1) unknown extra fields are
  ignored rather than rejected (the spec says so);
  (2) a non-object top-level arguments value is treated
  as an empty object, so it fails as `pr_body is
  required` (the spec says so); (3) zero whitespace
  between a closing keyword and `#<number>` still forms
  a closing reference ("optional whitespace" read as
  zero or more); (4) punctuation between a keyword and
  the reference (`fixes: #123`) is not a closing
  reference, because the spec allows only whitespace
  there — it remains a mention; (5) per-entry
  validation errors for `changed_files` and
  `commit_messages` name the entry's index
  (`changed_files[1]`, `commit_messages[0]`), following
  the fleet's path-naming pattern; (6) error-message
  wording follows the fleet's path-naming pattern (e.g.
  `issue_number must be an integer >= 1`). No other spec
  ambiguity was found in the core behaviour.
- Container build not exercised locally; the
  publish-container workflow smoke-tests the image at
  publish time.
- Nothing pushed or published; this is a local build only.
