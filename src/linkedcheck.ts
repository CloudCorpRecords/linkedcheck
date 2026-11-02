/**
 * linkedcheck core: verify a PR addresses the issue it
 * claims to close.
 *
 *   checkPrIssueLink(args) -> { verdict, closing_reference,
 *                               mentioned, matched_terms,
 *                               term_count }
 *
 * Closing keywords (pinned, case-insensitive, whole word):
 * close, closes, closed, fix, fixes, fixed, resolve,
 * resolves, resolved. A closing reference is a closing
 * keyword followed by optional whitespace and then
 * `#<issue_number>`, where the number is a whole token:
 * `#12` does not match issue 123 and `#1234` does not
 * match issue 123. Texts scanned: `pr_body` first, then
 * each commit message in input order.
 *
 * A mention is any occurrence of `#<issue_number>` (whole
 * token) in the scanned texts, whether or not a closing
 * keyword precedes it. A closing reference therefore
 * implies a mention.
 *
 * Issue-title terms (pinned): lowercase the title; split
 * on maximal runs of characters outside [a-z0-9]; drop
 * tokens shorter than 3 characters and drop the pinned
 * stopwords. The remaining distinct tokens are the terms,
 * and `term_count` is their number.
 *
 * Changed-file tokens (pinned): for each changed file
 * path, lowercase it and split on maximal runs of
 * characters outside [a-z0-9]; collect the distinct
 * tokens across all files. `matched_terms` is the terms
 * that appear among those tokens, sorted ascending.
 *
 * Verdict (pinned):
 *   "linked"        closing reference AND >= 1 matched term
 *   "weak"          closing reference AND no matched term
 *   "mentioned_only" no closing reference, but a mention
 *   "unlinked"      neither a closing reference nor a mention
 *
 * Validation is strict and path-naming: any malformed
 * input throws an Error naming the offending path and no
 * partial result is produced. Unknown extra fields are
 * ignored; a non-object top-level argument is treated
 * as {}.
 */
import type { LinkedCheckResult, LinkVerdict } from "./types.js";

export const VERSION = "0.1.0";

const CLOSING_KEYWORDS: readonly string[] = [
  "close",
  "closes",
  "closed",
  "fix",
  "fixes",
  "fixed",
  "resolve",
  "resolves",
  "resolved",
];

const STOPWORDS: ReadonlySet<string> = new Set([
  "the",
  "a",
  "an",
  "in",
  "on",
  "of",
  "for",
  "to",
  "when",
  "with",
  "and",
  "or",
  "is",
  "are",
  "be",
  "by",
  "at",
  "as",
  "it",
  "this",
  "that",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Split lowercased text on maximal runs outside [a-z0-9]. */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 0);
}

/** The distinct issue-title terms, per the pinned rules. */
export function issueTerms(issueTitle: string): string[] {
  const seen = new Set<string>();
  for (const token of tokenize(issueTitle)) {
    if (token.length < 3) continue;
    if (STOPWORDS.has(token)) continue;
    seen.add(token);
  }
  return [...seen];
}

/** The distinct tokens across all changed file paths. */
export function changedFileTokens(changedFiles: string[]): Set<string> {
  const seen = new Set<string>();
  for (const file of changedFiles) {
    for (const token of tokenize(file)) seen.add(token);
  }
  return seen;
}

function validateArgs(args: unknown): {
  prBody: string;
  issueNumber: number;
  issueTitle: string;
  changedFiles: string[];
  commitMessages: string[];
} {
  const raw: Record<string, unknown> = isRecord(args) ? args : {};

  if (raw.pr_body === undefined) throw new Error("pr_body is required");
  if (typeof raw.pr_body !== "string") {
    throw new Error("pr_body must be a string");
  }

  if (raw.issue_number === undefined) {
    throw new Error("issue_number is required");
  }
  if (
    typeof raw.issue_number !== "number" ||
    !Number.isInteger(raw.issue_number) ||
    raw.issue_number < 1
  ) {
    throw new Error("issue_number must be an integer >= 1");
  }

  if (raw.issue_title === undefined) {
    throw new Error("issue_title is required");
  }
  if (typeof raw.issue_title !== "string" || raw.issue_title.length === 0) {
    throw new Error("issue_title must be a non-empty string");
  }

  if (raw.changed_files === undefined) {
    throw new Error("changed_files is required");
  }
  if (!Array.isArray(raw.changed_files)) {
    throw new Error("changed_files must be an array of non-empty strings");
  }
  for (let i = 0; i < raw.changed_files.length; i++) {
    const entry: unknown = raw.changed_files[i];
    if (typeof entry !== "string" || entry.length === 0) {
      throw new Error(`changed_files[${i}] must be a non-empty string`);
    }
  }

  let commitMessages: string[] = [];
  if (raw.commit_messages !== undefined) {
    if (!Array.isArray(raw.commit_messages)) {
      throw new Error("commit_messages must be an array of strings");
    }
    for (let i = 0; i < raw.commit_messages.length; i++) {
      const entry: unknown = raw.commit_messages[i];
      if (typeof entry !== "string") {
        throw new Error(`commit_messages[${i}] must be a string`);
      }
    }
    commitMessages = raw.commit_messages as string[];
  }

  return {
    prBody: raw.pr_body,
    issueNumber: raw.issue_number,
    issueTitle: raw.issue_title,
    changedFiles: raw.changed_files as string[],
    commitMessages,
  };
}

/** Verify that a PR actually addresses the issue it claims to close. */
export function checkPrIssueLink(args: unknown): LinkedCheckResult {
  const { prBody, issueNumber, issueTitle, changedFiles, commitMessages } =
    validateArgs(args);

  const texts: string[] = [prBody, ...commitMessages];
  const numberPattern = escapeRegExp(String(issueNumber));
  const mentionRe = new RegExp(`#${numberPattern}(?![0-9])`);
  const closingRe = new RegExp(
    `\\b(?:${CLOSING_KEYWORDS.join("|")})\\b\\s*#${numberPattern}(?![0-9])`,
    "i",
  );

  let mentioned = false;
  let closingReference = false;
  for (const text of texts) {
    if (mentionRe.test(text)) mentioned = true;
    if (closingRe.test(text)) closingReference = true;
  }
  if (closingReference) mentioned = true;

  const terms = issueTerms(issueTitle);
  const fileTokens = changedFileTokens(changedFiles);
  const matchedTerms = terms.filter((term) => fileTokens.has(term)).sort();
  const termCount = terms.length;

  let verdict: LinkVerdict;
  if (closingReference && matchedTerms.length >= 1) verdict = "linked";
  else if (closingReference) verdict = "weak";
  else if (mentioned) verdict = "mentioned_only";
  else verdict = "unlinked";

  return {
    verdict,
    closing_reference: closingReference,
    mentioned,
    matched_terms: matchedTerms,
    term_count: termCount,
  };
}

/** Render a payload as the JSON text block MCP clients show. */
export function formatPayload(payload: unknown): string {
  return typeof payload === "string" ? payload : JSON.stringify(payload, null, 2);
}
