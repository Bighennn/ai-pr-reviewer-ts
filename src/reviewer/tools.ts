import type Anthropic from "@anthropic-ai/sdk";

/**
 * Tool definitions for structured output.
 *
 * We don't actually "call" these tools — we define tools whose schemas match
 * our domain types and let Claude emit findings as tool_use blocks. This is
 * far more reliable than asking for JSON in prose and parsing it.
 *
 * The schema here is hand-written rather than generated from Zod to keep the
 * tool description prose tight (descriptions are prompt-engineering surface).
 * The parsing side (reviewer.ts) validates with Zod, so the two stay honest.
 */

export const REPORT_FINDING_TOOL: Anthropic.Tool = {
  name: "report_finding",
  description:
    "Report a single issue found in the diff. Call once per distinct issue. " +
    "Only report issues introduced or visible in the added lines.",
  input_schema: {
    type: "object",
    properties: {
      file: { type: "string" },
      line: { type: "integer", minimum: 1 },
      endLine: { type: "integer", minimum: 1 },
      severity: {
        type: "string",
        enum: ["critical", "high", "medium", "low", "info"],
      },
      category: {
        type: "string",
        enum: [
          "bug",
          "security",
          "performance",
          "style",
          "maintainability",
          "testing",
          "documentation",
        ],
      },
      title: { type: "string", maxLength: 120 },
      body: { type: "string" },
      suggestedReplacement: {
        type: "string",
        description:
          "Optional. Exact replacement text for the flagged line(s). " +
          "Rendered as a GitHub suggestion block.",
      },
      ruleId: { type: "string" },
    },
    required: ["file", "line", "severity", "category", "title", "body"],
  },
};

export const SUBMIT_REVIEW_TOOL: Anthropic.Tool = {
  name: "submit_review",
  description: "Call exactly once at the end to submit the overall summary.",
  input_schema: {
    type: "object",
    properties: {
      summary: {
        type: "string",
        description:
          "2-5 sentence overall assessment. Plain prose, no markdown headers.",
      },
    },
    required: ["summary"],
  },
};
