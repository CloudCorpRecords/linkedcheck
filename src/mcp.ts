/**
 * linkedcheck MCP server. Tools: check_pr_issue_link.
 *
 * Why the low-level Server instead of McpServer: the high-level
 * helper converts zod schemas to JSON Schema and injects keys
 * not in this tool's defined spec ("$schema" and
 * "additionalProperties"), which breaks exact tool-list/schema
 * parity with the spec. This file serves tools/list with the
 * spec's exact input schema as an explicit literal, and every
 * tools/call is validated by the core, which names the
 * offending path on invalid input.
 *
 * The computation is pure and local: no upstream API, no
 * authentication, no configuration, and no repository is
 * touched — the tool only checks the supplied texts and paths.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { checkPrIssueLink, formatPayload, VERSION } from "./linkedcheck.js";

const TOOLS = [
  {
    name: "check_pr_issue_link",
    description:
      "Verify that a pull request actually addresses the issue it claims to close: scan the PR body and commit messages for closing keywords referencing the issue, and check the issue title's terms against the changed files.",
    inputSchema: {
      type: "object" as const,
      properties: {
        pr_body: {
          type: "string",
          description: "Pull request body text",
        },
        issue_number: {
          type: "integer",
          description: "Number of the issue the PR claims to close",
        },
        issue_title: {
          type: "string",
          description: "Title of the issue the PR claims to close",
        },
        changed_files: {
          type: "array",
          items: { type: "string" },
          description: "Paths of the files the PR changes",
        },
        commit_messages: {
          type: "array",
          items: { type: "string" },
          description: "Commit messages of the PR (optional)",
        },
      },
      required: ["pr_body", "issue_number", "issue_title", "changed_files"],
    },
  },
];

function textResult(value: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: typeof value === "string" ? value : JSON.stringify(value, null, 2),
      },
    ],
  };
}

function errorResult(err: unknown) {
  return {
    content: [
      { type: "text" as const, text: err instanceof Error ? err.message : String(err) },
    ],
    isError: true,
  };
}

const server = new Server(
  { name: "linkedcheck", version: VERSION },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    let out: unknown;
    if (name === "check_pr_issue_link") {
      out = checkPrIssueLink(args ?? {});
    } else {
      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
    return textResult(formatPayload(out));
  } catch (err) {
    if (err instanceof McpError) throw err;
    return errorResult(err);
  }
});

async function main(): Promise<void> {
  await server.connect(new StdioServerTransport());
}

void main();
