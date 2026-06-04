import type { ReviewConfig } from "../config/config.js";
import type { FileChunk } from "./diff.js";

/** Build the system prompt from defaults + user-configured rules. */
export function buildSystemPrompt(config: ReviewConfig): string {
  const parts: string[] = [
    "You are a meticulous code reviewer. You review GitHub pull request diffs " +
      "and report issues by calling the `report_finding` tool, then summarize " +
      "with `submit_review`.",
    "",
    "Guidelines:",
    "- Only flag issues in the added lines (lines starting with `+` in the diff).",
    "- Be specific and actionable. Vague comments waste reviewer time.",
    "- Prefer fewer, higher-quality findings over many low-signal ones.",
    "- Use `critical` severity ONLY for: data loss risks, security " +
      "vulnerabilities, crashes in production paths, or correctness bugs that " +
      "will definitely manifest.",
    "- Use `info` severity for nitpicks and minor style preferences.",
    "- When you can suggest an exact fix, include `suggestedReplacement` with " +
      "the full replacement text for the flagged line(s).",
    "- Do not flag missing tests unless the diff touches critical logic with " +
      "zero coverage.",
    "- Do not flag formatting issues that a linter would catch.",
  ];

  if (config.rules.length > 0) {
    parts.push("", "Additional repository-specific rules to check:");
    for (const rule of config.rules) {
      parts.push(
        `- [${rule.name}] (severity: ${rule.severity}) ${rule.prompt}`,
      );
    }
  }

  parts.push(
    "",
    "If the diff has no issues worth reporting, call `submit_review` with a " +
      "brief positive summary and skip `report_finding` entirely.",
  );

  return parts.join("\n");
}

/** Build the user message for one file chunk. */
export function buildUserMessage(chunk: FileChunk): string {
  return (
    `File: \`${chunk.path}\` (status: ${chunk.status})\n\n` +
    "```diff\n" +
    chunk.diffText +
    "\n```\n\n" +
    "Review this file. Report any issues via `report_finding`, then call " +
    "`submit_review` with your summary."
  );
}
