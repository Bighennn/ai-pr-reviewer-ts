import Anthropic from "@anthropic-ai/sdk";
import { Finding, type ReviewResult, severityAtLeast } from "./schema.js";
import { type ReviewConfig, shouldReviewPath } from "../config/config.js";
import { type FileChunk, isReviewable } from "./diff.js";
import { REPORT_FINDING_TOOL, SUBMIT_REVIEW_TOOL } from "./tools.js";
import { buildSystemPrompt, buildUserMessage } from "./prompt.js";

export const DEFAULT_MODEL = "claude-sonnet-4-6";

export interface ReviewerOptions {
  model?: string;
  maxTokens?: number;
}

/**
 * Runs the review loop against the Anthropic API.
 *
 * TODOs to expand (later days):
 *  - retry on tool-use validation failure (round-trip the error)
 *  - prompt caching for the system prompt (cache_control)
 *  - per-file parallelism with a bounded concurrency limit
 */
export class LLMReviewer {
  private readonly client: Anthropic;
  private readonly model: string;
  private readonly maxTokens: number;

  constructor(client: Anthropic, opts: ReviewerOptions = {}) {
    this.client = client;
    this.model = opts.model ?? DEFAULT_MODEL;
    this.maxTokens = opts.maxTokens ?? 4096;
  }

  /** Review a single file chunk. */
  async reviewFile(
    chunk: FileChunk,
    config: ReviewConfig,
  ): Promise<ReviewResult> {
    const response = await this.client.messages.create({
      model: config.model ?? this.model,
      max_tokens: this.maxTokens,
      system: buildSystemPrompt(config),
      tools: [REPORT_FINDING_TOOL, SUBMIT_REVIEW_TOOL],
      messages: [{ role: "user", content: buildUserMessage(chunk) }],
    });

    const findings: Finding[] = [];
    let summary = "";

    for (const block of response.content) {
      if (block.type !== "tool_use") continue;

      if (block.name === "report_finding") {
        const parsed = Finding.safeParse(block.input);
        if (parsed.success) {
          findings.push(parsed.data);
        } else {
          console.warn(
            `[reviewer] dropped invalid finding in ${chunk.path}: ${parsed.error.message}`,
          );
        }
      } else if (block.name === "submit_review") {
        const input = block.input as { summary?: string };
        summary = input.summary ?? "";
      }
    }

    if (!summary) {
      summary =
        findings.length > 0
          ? `Reviewed \`${chunk.path}\`: ${findings.length} finding(s).`
          : `No issues found in \`${chunk.path}\`.`;
    }

    return { findings, summary };
  }

  /** Review all reviewable chunks in a PR and merge results. */
  async reviewPr(
    chunks: FileChunk[],
    config: ReviewConfig,
  ): Promise<ReviewResult> {
    const allFindings: Finding[] = [];

    for (const chunk of chunks) {
      if (!isReviewable(chunk)) continue;
      if (!shouldReviewPath(chunk.path, config)) {
        console.info(`[reviewer] path ignored: ${chunk.path}`);
        continue;
      }
      const result = await this.reviewFile(chunk, config);
      allFindings.push(...result.findings);
    }

    const filtered = allFindings.filter((f) =>
      severityAtLeast(f.severity, config.severityThreshold),
    );

    return { findings: filtered, summary: aggregateSummary(filtered) };
  }
}

function aggregateSummary(findings: Finding[]): string {
  if (findings.length === 0) return "No issues found. Looks good.";

  const bySeverity = new Map<string, number>();
  for (const f of findings) {
    bySeverity.set(f.severity, (bySeverity.get(f.severity) ?? 0) + 1);
  }

  const parts = [`Found ${findings.length} issue(s):`];
  for (const sev of ["critical", "high", "medium", "low", "info"]) {
    const count = bySeverity.get(sev);
    if (count) parts.push(`- **${sev}**: ${count}`);
  }
  return parts.join("\n");
}
