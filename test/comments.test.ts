import { describe, it, expect } from "vitest";
import {
  formatInlineComment,
  formatSummaryBody,
  formatStatus,
  SUMMARY_MARKER,
} from "../src/github/comments.js";
import type { Finding, ReviewResult } from "../src/reviewer/schema.js";

function finding(overrides: Partial<Finding> = {}): Finding {
  return {
    file: "src/foo.ts",
    line: 10,
    severity: "high",
    category: "bug",
    title: "Off-by-one error",
    body: "The loop bound is incorrect.",
    ...overrides,
  };
}

describe("formatInlineComment", () => {
  it("formats a basic comment", () => {
    const c = formatInlineComment(finding());
    expect(c.path).toBe("src/foo.ts");
    expect(c.line).toBe(10);
    expect(c.side).toBe("RIGHT");
    expect(c.body).toContain("HIGH");
    expect(c.body).toContain("Off-by-one error");
    expect(c.start_line).toBeUndefined();
  });

  it("includes a suggestion block", () => {
    const c = formatInlineComment(
      finding({ suggestedReplacement: "  for (let i = 0; i < n; i++) {" }),
    );
    expect(c.body).toContain("```suggestion");
    expect(c.body).toContain("for (let i = 0; i < n; i++)");
  });

  it("handles multi-line ranges", () => {
    const c = formatInlineComment(finding({ line: 10, endLine: 15 }));
    expect(c.line).toBe(15);
    expect(c.start_line).toBe(10);
    expect(c.start_side).toBe("RIGHT");
  });
});

describe("formatSummaryBody", () => {
  it("handles no findings", () => {
    const result: ReviewResult = { findings: [], summary: "All good." };
    const body = formatSummaryBody(result);
    expect(body).toContain(SUMMARY_MARKER);
    expect(body).toContain("All good.");
    expect(body).not.toContain("Findings by severity");
  });

  it("counts findings by severity", () => {
    const result: ReviewResult = {
      findings: [
        finding({ severity: "critical" }),
        finding({ severity: "high" }),
        finding({ severity: "high" }),
      ],
      summary: "Found 3 issues",
    };
    const body = formatSummaryBody(result);
    expect(body).toContain("**critical**: 1");
    expect(body).toContain("**high**: 2");
  });
});

describe("formatStatus", () => {
  it("passes when nothing is blocking", () => {
    const result: ReviewResult = {
      findings: [finding({ severity: "high" })],
      summary: "ok",
    };
    const status = formatStatus(result, "critical");
    expect(status.state).toBe("success");
    expect(status.description).toContain("non-blocking");
  });

  it("fails on a critical finding", () => {
    const result: ReviewResult = {
      findings: [finding({ severity: "critical" })],
      summary: "bad",
    };
    const status = formatStatus(result, "critical");
    expect(status.state).toBe("failure");
    expect(status.description).toContain("blocking");
  });
});
