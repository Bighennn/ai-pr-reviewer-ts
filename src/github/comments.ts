import {
  type Finding,
  type ReviewResult,
  type Severity,
  countBlocking,
  severityAtLeast,
} from "../reviewer/schema.js";

/** Marker embedded in our summary so we can find/update our own review later. */
export const SUMMARY_MARKER = "<!-- ai-pr-reviewer:summary -->";

const SEVERITY_EMOJI: Record<Severity, string> = {
  critical: "🚨",
  high: "⚠️",
  medium: "⚡",
  low: "💡",
  info: "ℹ️",
};

export interface InlineComment {
  path: string;
  line: number;
  side: "RIGHT";
  body: string;
  start_line?: number;
  start_side?: "RIGHT";
}

/** Convert a Finding into a GitHub review-comment payload. */
export function formatInlineComment(finding: Finding): InlineComment {
  const emoji = SEVERITY_EMOJI[finding.severity];
  const lines = [
    `${emoji} **${finding.severity.toUpperCase()} · ${finding.category}** — ${finding.title}`,
    "",
    finding.body,
  ];

  if (finding.suggestedReplacement !== undefined) {
    lines.push("", "```suggestion", finding.suggestedReplacement, "```");
  }
  if (finding.ruleId) {
    lines.push("", `_Rule: \`${finding.ruleId}\`_`);
  }

  const comment: InlineComment = {
    path: finding.file,
    line: finding.endLine ?? finding.line,
    side: "RIGHT",
    body: lines.join("\n"),
  };
  if (finding.endLine && finding.endLine !== finding.line) {
    comment.start_line = finding.line;
    comment.start_side = "RIGHT";
  }
  return comment;
}

/** Format the top-level review summary body. */
export function formatSummaryBody(result: ReviewResult): string {
  const lines = [SUMMARY_MARKER, "## AI Review Summary", "", result.summary];

  if (result.findings.length > 0) {
    lines.push("", "### Findings by severity", "");
    const bySeverity = new Map<Severity, number>();
    for (const f of result.findings) {
      bySeverity.set(f.severity, (bySeverity.get(f.severity) ?? 0) + 1);
    }
    for (const sev of [
      "critical",
      "high",
      "medium",
      "low",
      "info",
    ] as Severity[]) {
      const count = bySeverity.get(sev);
      if (count) lines.push(`- ${SEVERITY_EMOJI[sev]} **${sev}**: ${count}`);
    }
  }

  lines.push(
    "",
    "---",
    "_Posted by ai-pr-reviewer. Configure via `.aireview.yml` in your repo._",
  );
  return lines.join("\n");
}

export interface CommitStatus {
  state: "success" | "failure";
  description: string;
}

/** Decide the commit status from findings + the blocking threshold. */
export function formatStatus(
  result: ReviewResult,
  blockOn: Severity,
): CommitStatus {
  const blocking = countBlocking(result.findings, blockOn);
  if (blocking === 0) {
    return {
      state: "success",
      description: `AI review passed (${result.findings.length} non-blocking finding(s))`,
    };
  }
  return {
    state: "failure",
    description: `${blocking} blocking finding(s) at severity >= ${blockOn}`,
  };
}

export { severityAtLeast };
