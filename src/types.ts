/**
 * linkedcheck types.
 *
 * linkedcheck verifies that a pull request actually
 * addresses the issue it claims to close. The caller
 * supplies the PR body, the issue number and title, the
 * changed file paths, and optionally the commit messages.
 * From that data alone, as pure local computation,
 * linkedcheck reports:
 *
 *   - the verdict ("linked", "weak", "mentioned_only",
 *     or "unlinked")
 *   - whether a closing reference was found
 *   - whether the issue was mentioned at all
 *   - the issue-title terms matched in the changed files
 *   - the total number of distinct issue-title terms
 */

/** Verdicts a PR/issue link check may produce. */
export type LinkVerdict = "linked" | "weak" | "mentioned_only" | "unlinked";

/** The arguments accepted by checkPrIssueLink, after validation. */
export interface LinkedCheckInput {
  /** Pull request body text; may be empty. */
  pr_body: string;
  /** Number of the issue the PR claims to close; an integer of at least 1. */
  issue_number: number;
  /** Title of the issue the PR claims to close; non-empty. */
  issue_title: string;
  /** Paths of the files the PR changes; may be empty, entries non-empty. */
  changed_files: string[];
  /** Commit messages of the PR; defaults to an empty list. */
  commit_messages: string[];
}

/** The result of verifying a PR against its claimed issue. */
export interface LinkedCheckResult {
  /** The pinned verdict. */
  verdict: LinkVerdict;
  /** Whether a closing reference to the issue was found. */
  closing_reference: boolean;
  /** Whether the issue was mentioned at all. */
  mentioned: boolean;
  /** Issue-title terms found among the changed-file tokens, sorted ascending. */
  matched_terms: string[];
  /** The number of distinct issue-title terms. */
  term_count: number;
}
