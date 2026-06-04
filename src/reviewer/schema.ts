import { z } from "zod";

/**
 * Domain schema for review findings.
 *
 * Zod gives us three things from one definition:
 *  - a runtime validator (parse Claude's tool-use output safely)
 *  - a static TypeScript type (z.infer)
 *  - a JSON Schema for the Anthropic tool definition (see reviewer/tools.ts)
 *
 * This is the contract between the LLM and the rest of the pipeline. Keep it
 * stable; comment formatting, the eval harness, and commit-status logic all
 * depend on it.
 */

export const Severity = z.enum(["critical", "high", "medium", "low", "info"]);
export type Severity = z.infer<typeof Severity>;

export const Category = z.enum([
  "bug",
  "security",
  "performance",
  "style",
  "maintainability",
  "testing",
  "documentation",
]);
export type Category = z.infer<typeof Category>;

/**
 * A single issue. `line` is 1-indexed in the NEW version of the file (what
 * GitHub calls the RIGHT side of a diff). `suggestedReplacement`, when set,
 * is rendered as a GitHub suggestion block for one-click apply.
 */
export const Finding = z.object({
  file: z.string().describe("Path of the file, relative to repo root"),
  line: z.number().int().min(1).describe("1-indexed line in the new file"),
  endLine: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe("Optional inclusive end of a multi-line range"),
  severity: Severity,
  category: Category,
  title: z.string().max(120).describe("One-line headline"),
  body: z.string().describe("Detailed explanation. Markdown allowed."),
  suggestedReplacement: z
    .string()
    .optional()
    .describe("If present, posted as a GitHub suggestion block"),
  ruleId: z
    .string()
    .optional()
    .describe("Which configured rule produced this finding"),
});
export type Finding = z.infer<typeof Finding>;

export interface ReviewResult {
  findings: Finding[];
  summary: string;
}

const SEVERITY_ORDER: Severity[] = [
  "info",
  "low",
  "medium",
  "high",
  "critical",
];

/** True if `a` is at least as severe as `b`. */
export function severityAtLeast(a: Severity, b: Severity): boolean {
  return SEVERITY_ORDER.indexOf(a) >= SEVERITY_ORDER.indexOf(b);
}

export function countBlocking(findings: Finding[], blockOn: Severity): number {
  return findings.filter((f) => severityAtLeast(f.severity, blockOn)).length;
}
