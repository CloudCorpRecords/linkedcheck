import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { checkPrIssueLink, issueTerms } from "../src/linkedcheck.js";

/**
 * All tests are pure local computation over inline texts
 * and paths: no filesystem and no network. The closing
 * keyword set (case-insensitivity, whole-word, whole-token
 * number matching, optional whitespace), mention
 * detection, the stopword/length filtering of title
 * terms, file-token matching, all four verdicts, every
 * validation path, and the boundary cases (prefix issue
 * numbers, empty pr_body, empty changed_files) are each
 * pinned.
 */

const base = (extra: Record<string, unknown> = {}) => ({
  pr_body: "Fixes #123",
  issue_number: 123,
  issue_title: "Fix login redirect loop",
  changed_files: ["src/login/redirect.ts"],
  ...extra,
});

describe("checkPrIssueLink — closing keywords", () => {
  it("every pinned closing keyword forms a closing reference", () => {
    for (const kw of [
      "close",
      "closes",
      "closed",
      "fix",
      "fixes",
      "fixed",
      "resolve",
      "resolves",
      "resolved",
    ]) {
      const out = checkPrIssueLink(base({ pr_body: `${kw} #123` }));
      assert.equal(out.closing_reference, true, kw);
      assert.equal(out.mentioned, true, kw);
    }
  });

  it("closing keywords are case-insensitive", () => {
    for (const body of ["FIXES #123", "ClOsEs #123", "Resolved #123", "CLOSE #123"]) {
      assert.equal(checkPrIssueLink(base({ pr_body: body })).closing_reference, true, body);
    }
  });

  it("a keyword embedded in a longer word is not a closing keyword", () => {
    for (const body of ["prefixes #123", "fixedly #123", "closely #123", "enclosed #123"]) {
      const out = checkPrIssueLink(base({ pr_body: body }));
      assert.equal(out.closing_reference, false, body);
      assert.equal(out.mentioned, true, body);
      assert.equal(out.verdict, "mentioned_only", body);
    }
  });

  it("whitespace between keyword and reference is optional and flexible", () => {
    for (const body of ["fixes#123", "fixes #123", "fixes   #123", "fixes\t#123", "fixes\n#123"]) {
      assert.equal(checkPrIssueLink(base({ pr_body: body })).closing_reference, true, body);
    }
  });

  it("punctuation between keyword and reference breaks the closing link", () => {
    const out = checkPrIssueLink(base({ pr_body: "fixes: #123" }));
    assert.equal(out.closing_reference, false);
    assert.equal(out.mentioned, true);
    assert.equal(out.verdict, "mentioned_only");
  });

  it("a keyword referencing a different issue is not a closing reference", () => {
    const out = checkPrIssueLink(base({ pr_body: "fixes #999" }));
    assert.equal(out.closing_reference, false);
    assert.equal(out.mentioned, false);
    assert.equal(out.verdict, "unlinked");
  });

  it("a closing reference in a commit message counts", () => {
    const out = checkPrIssueLink(
      base({ pr_body: "work in progress", commit_messages: ["tidy up", "Resolves #123"] }),
    );
    assert.equal(out.closing_reference, true);
    assert.equal(out.verdict, "linked");
  });

  it("a closing reference in the PR body counts when commits do not have one", () => {
    const out = checkPrIssueLink(base({ commit_messages: ["unrelated work"] }));
    assert.equal(out.closing_reference, true);
    assert.equal(out.verdict, "linked");
  });
});

describe("checkPrIssueLink — mention detection and whole-token numbers", () => {
  it("a bare #<number> is a mention but not a closing reference", () => {
    const out = checkPrIssueLink(base({ pr_body: "See #123 for context" }));
    assert.deepEqual(out, {
      verdict: "mentioned_only",
      closing_reference: false,
      mentioned: true,
      matched_terms: ["login", "redirect"],
      term_count: 4,
    });
  });

  it("a mention in a commit message counts", () => {
    const out = checkPrIssueLink(
      base({ pr_body: "no reference here", commit_messages: ["relates to #123"] }),
    );
    assert.equal(out.mentioned, true);
    assert.equal(out.closing_reference, false);
    assert.equal(out.verdict, "mentioned_only");
  });

  it("#12 does not match issue 123 (prefix boundary)", () => {
    const out = checkPrIssueLink(base({ pr_body: "fixes #12" }));
    assert.equal(out.mentioned, false);
    assert.equal(out.closing_reference, false);
    assert.equal(out.verdict, "unlinked");
  });

  it("#1234 does not match issue 123 (longer-number boundary)", () => {
    const out = checkPrIssueLink(base({ pr_body: "fixes #1234" }));
    assert.equal(out.mentioned, false);
    assert.equal(out.closing_reference, false);
    assert.equal(out.verdict, "unlinked");
  });

  it("#123 followed by punctuation is a whole-token match", () => {
    for (const body of ["fixes #123.", "fixes #123)", "(fixes #123)", "fixes #123,"]) {
      const out = checkPrIssueLink(base({ pr_body: body }));
      assert.equal(out.closing_reference, true, body);
    }
  });

  it("issue 12 is matched by #12 but not by #123", () => {
    const hit = checkPrIssueLink(base({ pr_body: "fixes #12", issue_number: 12 }));
    assert.equal(hit.closing_reference, true);
    const miss = checkPrIssueLink(base({ pr_body: "fixes #123", issue_number: 12 }));
    assert.equal(miss.closing_reference, false);
    assert.equal(miss.mentioned, false);
  });

  it("a closing reference implies a mention", () => {
    const out = checkPrIssueLink(base({}));
    assert.equal(out.closing_reference, true);
    assert.equal(out.mentioned, true);
  });

  it("no reference at all is unlinked", () => {
    const out = checkPrIssueLink(base({ pr_body: "a brand new feature" }));
    assert.equal(out.mentioned, false);
    assert.equal(out.closing_reference, false);
    assert.equal(out.verdict, "unlinked");
  });
});

describe("checkPrIssueLink — issue-title terms", () => {
  it("terms are distinct lowercased tokens of the title", () => {
    assert.deepEqual(issueTerms("Fix LOGIN Redirect login"), ["fix", "login", "redirect"]);
  });

  it("every pinned stopword is dropped", () => {
    const title =
      "the a an in on of for to when with and or is are be by at as it this that login";
    assert.deepEqual(issueTerms(title), ["login"]);
  });

  it("tokens shorter than 3 characters are dropped and length 3 is kept", () => {
    assert.deepEqual(issueTerms("Fix a bug in UI on go app"), ["fix", "bug", "app"]);
  });

  it("punctuation splits the title into tokens", () => {
    assert.deepEqual(issueTerms("login/redirect: loop (broken)!"), [
      "login",
      "redirect",
      "loop",
      "broken",
    ]);
  });

  it("digit tokens of length at least 3 are terms", () => {
    assert.deepEqual(issueTerms("HTTP 404 error"), ["http", "404", "error"]);
  });

  it("a title of only stopwords and short tokens has zero terms", () => {
    const out = checkPrIssueLink(base({ issue_title: "The a an in on of it is to" }));
    assert.equal(out.term_count, 0);
    assert.deepEqual(out.matched_terms, []);
    assert.equal(out.verdict, "weak");
  });

  it("term_count counts distinct terms only", () => {
    const out = checkPrIssueLink(base({ issue_title: "Login login LOGIN loop" }));
    assert.equal(out.term_count, 2);
  });
});

describe("checkPrIssueLink — changed-file token matching", () => {
  it("terms match tokens from directories, file stems, and extensions", () => {
    const out = checkPrIssueLink(
      base({ changed_files: ["src/login/redirect.ts", "docs/loop.md"] }),
    );
    assert.deepEqual(out.matched_terms, ["login", "loop", "redirect"]);
    assert.equal(out.term_count, 4);
  });

  it("file token matching is case-insensitive and splits on punctuation", () => {
    const out = checkPrIssueLink(
      base({ changed_files: ["SRC/Login_Page/REDIRECT-HANDLER.TS"] }),
    );
    assert.deepEqual(out.matched_terms, ["login", "redirect"]);
  });

  it("a term that is only a substring of a file token does not match", () => {
    const out = checkPrIssueLink(base({ changed_files: ["src/loginpage.ts"] }));
    assert.deepEqual(out.matched_terms, []);
    assert.equal(out.verdict, "weak");
  });

  it("matched_terms are sorted ascending regardless of title or file order", () => {
    const out = checkPrIssueLink(
      base({
        issue_title: "Redirect broken login",
        changed_files: ["z/redirect.ts", "a/login.ts", "m/broken.ts"],
      }),
    );
    assert.deepEqual(out.matched_terms, ["broken", "login", "redirect"]);
  });

  it("duplicate matches across files are reported once", () => {
    const out = checkPrIssueLink(
      base({ changed_files: ["src/login/a.ts", "src/login/b.ts"] }),
    );
    assert.deepEqual(out.matched_terms, ["login"]);
  });
});

describe("checkPrIssueLink — the four verdicts", () => {
  it("linked: closing reference and at least one matched term", () => {
    assert.deepEqual(checkPrIssueLink(base({})), {
      verdict: "linked",
      closing_reference: true,
      mentioned: true,
      matched_terms: ["login", "redirect"],
      term_count: 4,
    });
  });

  it("weak: closing reference and no matched term", () => {
    assert.deepEqual(
      checkPrIssueLink(base({ changed_files: ["src/unrelated/thing.ts"] })),
      {
        verdict: "weak",
        closing_reference: true,
        mentioned: true,
        matched_terms: [],
        term_count: 4,
      },
    );
  });

  it("mentioned_only: mention without a closing reference (matched terms do not upgrade it)", () => {
    const out = checkPrIssueLink(base({ pr_body: "Related to #123" }));
    assert.equal(out.verdict, "mentioned_only");
    assert.deepEqual(out.matched_terms, ["login", "redirect"]);
  });

  it("unlinked: neither a closing reference nor a mention", () => {
    const out = checkPrIssueLink(base({ pr_body: "hello world" }));
    assert.equal(out.verdict, "unlinked");
    assert.equal(out.closing_reference, false);
    assert.equal(out.mentioned, false);
  });
});

describe("checkPrIssueLink — boundary cases", () => {
  it("an empty pr_body is valid", () => {
    const out = checkPrIssueLink(base({ pr_body: "" }));
    assert.equal(out.verdict, "unlinked");
    assert.equal(out.term_count, 4);
  });

  it("an empty pr_body can still be linked by a commit message", () => {
    const out = checkPrIssueLink(base({ pr_body: "", commit_messages: ["fixes #123"] }));
    assert.equal(out.verdict, "linked");
  });

  it("an empty changed_files list is valid and yields no matched terms", () => {
    const out = checkPrIssueLink(base({ changed_files: [] }));
    assert.deepEqual(out.matched_terms, []);
    assert.equal(out.term_count, 4);
    assert.equal(out.verdict, "weak");
  });

  it("empty changed_files with only a mention is mentioned_only", () => {
    const out = checkPrIssueLink(base({ pr_body: "see #123", changed_files: [] }));
    assert.equal(out.verdict, "mentioned_only");
  });

  it("commit_messages defaults to empty when omitted", () => {
    const out = checkPrIssueLink(base({}));
    assert.equal(out.verdict, "linked");
  });

  it("empty-string commit messages are valid strings", () => {
    const out = checkPrIssueLink(base({ pr_body: "", commit_messages: [""] }));
    assert.equal(out.verdict, "unlinked");
  });

  it("issue_number 1 is valid", () => {
    const out = checkPrIssueLink(base({ pr_body: "fixes #1", issue_number: 1 }));
    assert.equal(out.closing_reference, true);
  });
});

describe("checkPrIssueLink — validation", () => {
  const throws = (args: unknown, message: string) =>
    assert.throws(() => checkPrIssueLink(args), { message });

  it("pr_body missing names pr_body", () => {
    const { pr_body: _drop, ...rest } = base({});
    throws(rest, "pr_body is required");
    throws({}, "pr_body is required");
  });

  it("pr_body non-string names pr_body", () => {
    for (const bad of [42, null, true, ["x"]]) {
      throws(base({ pr_body: bad }), "pr_body must be a string");
    }
  });

  it("issue_number missing names issue_number", () => {
    const { issue_number: _drop, ...rest } = base({});
    throws(rest, "issue_number is required");
  });

  it("issue_number not an integer >= 1 names issue_number", () => {
    for (const bad of [0, -3, 1.5, "123", true, null]) {
      throws(base({ issue_number: bad }), "issue_number must be an integer >= 1");
    }
  });

  it("issue_title missing names issue_title", () => {
    const { issue_title: _drop, ...rest } = base({});
    throws(rest, "issue_title is required");
  });

  it("issue_title empty or non-string names issue_title", () => {
    for (const bad of ["", 42, null, ["x"]]) {
      throws(base({ issue_title: bad }), "issue_title must be a non-empty string");
    }
  });

  it("changed_files missing names changed_files", () => {
    const { changed_files: _drop, ...rest } = base({});
    throws(rest, "changed_files is required");
  });

  it("changed_files not an array names changed_files", () => {
    for (const bad of ["src/a.ts", 42, null, {}]) {
      throws(base({ changed_files: bad }), "changed_files must be an array of non-empty strings");
    }
  });

  it("changed_files holding a non-string or empty entry names its index", () => {
    throws(base({ changed_files: [42] }), "changed_files[0] must be a non-empty string");
    throws(base({ changed_files: ["ok.ts", ""] }), "changed_files[1] must be a non-empty string");
    throws(base({ changed_files: ["ok.ts", null] }), "changed_files[1] must be a non-empty string");
  });

  it("commit_messages present but not an array names commit_messages", () => {
    for (const bad of ["fixes #123", 42, null, {}]) {
      throws(base({ commit_messages: bad }), "commit_messages must be an array of strings");
    }
  });

  it("commit_messages holding a non-string names its index", () => {
    throws(base({ commit_messages: ["ok", 7] }), "commit_messages[1] must be a string");
    throws(base({ commit_messages: [null] }), "commit_messages[0] must be a string");
  });

  it("unknown extra fields are ignored (pinned judgement call)", () => {
    const out = checkPrIssueLink(base({ labels: ["bug"], draft: true }));
    assert.equal(out.verdict, "linked");
  });

  it("a non-object top-level argument is treated as {} (pinned judgement call)", () => {
    throws(null, "pr_body is required");
    throws([], "pr_body is required");
    throws("fixes #123", "pr_body is required");
    throws(42, "pr_body is required");
  });

  it("no partial result is produced on invalid input", () => {
    assert.throws(() => checkPrIssueLink(base({ changed_files: ["ok.ts", 3] })));
  });
});
