import type { Probot, Context } from "probot";
import Anthropic from "@anthropic-ai/sdk";
import { parsePrDiff } from "./reviewer/diff.js";
import { LLMReviewer } from "./reviewer/reviewer.js";
import {
  DEFAULT_CONFIG,
  type ReviewConfig,
  parseConfig,
} from "./config/config.js";
import {
  formatInlineComment,
  formatStatus,
  formatSummaryBody,
} from "./github/comments.js";

/**
 * Probot entrypoint.
 *
 * Probot handles for us, before we ever see an event:
 *  - webhook signature verification (HMAC)
 *  - the GitHub App JWT -> installation token exchange
 *  - event routing and an authenticated Octokit client (context.octokit)
 *
 * So this file is purely our business logic: on a PR event, fetch the diff,
 * review it, and post the results back.
 *
 * We call GitHub through `octokit.request(...)` with explicit endpoint strings
 * rather than the `.repos.*` / `.pulls.*` namespaced helpers. Both hit the same
 * REST API; the explicit form is self-documenting and avoids depending on REST
 * plugin types being present on the Probot Octokit instance.
 */

type PrContext = Context<"pull_request">;

export default function app(probot: Probot): void {
  probot.on(
    [
      "pull_request.opened",
      "pull_request.synchronize",
      "pull_request.reopened",
      "pull_request.ready_for_review",
    ],
    async (context) => {
      await runReview(context);
    },
  );

  probot.log.info("ai-pr-reviewer is running");
}

async function runReview(context: PrContext): Promise<void> {
  const pr = context.payload.pull_request;
  const { owner, repo } = context.repo();
  const headSha = pr.head.sha;
  const slug = `${owner}/${repo}#${pr.number}`;

  context.log.info({ slug, sha: headSha }, "review_start");

  try {
    const config = await loadRepoConfig(context, headSha);

    await setStatus(context, headSha, "pending", "AI review in progress…");

    const diffRes = await context.octokit.request(
      "GET /repos/{owner}/{repo}/pulls/{pull_number}",
      {
        owner,
        repo,
        pull_number: pr.number,
        headers: { accept: "application/vnd.github.v3.diff" },
      },
    );
    const diffText = diffRes.data as unknown as string;

    const chunks = parsePrDiff(diffText);
    context.log.info({ slug, files: chunks.length }, "diff_parsed");

    if (chunks.length > config.maxFilesPerReview) {
      context.log.warn({ slug, files: chunks.length }, "pr_too_large");
      await setStatus(
        context,
        headSha,
        "success",
        `PR too large for AI review (${chunks.length} files)`,
      );
      return;
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

    const reviewer = new LLMReviewer(new Anthropic({ apiKey }), {
      model: process.env.ANTHROPIC_MODEL,
    });
    const result = await reviewer.reviewPr(chunks, config);

    await context.octokit.request(
      "POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews",
      {
        owner,
        repo,
        pull_number: pr.number,
        commit_id: headSha,
        body: formatSummaryBody(result),
        event: "COMMENT",
        comments: result.findings.map(formatInlineComment),
      },
    );

    const status = formatStatus(result, config.blockOn);
    await setStatus(context, headSha, status.state, status.description);

    context.log.info(
      { slug, findings: result.findings.length, state: status.state },
      "review_complete",
    );
  } catch (err) {
    context.log.error({ slug, err }, "review_failed");
    try {
      await setStatus(context, headSha, "error", "AI review failed (see logs)");
    } catch (statusErr) {
      context.log.error({ slug, statusErr }, "status_update_failed");
    }
  }
}

async function setStatus(
  context: PrContext,
  sha: string,
  state: "pending" | "success" | "failure" | "error",
  description: string,
): Promise<void> {
  const { owner, repo } = context.repo();
  await context.octokit.request("POST /repos/{owner}/{repo}/statuses/{sha}", {
    owner,
    repo,
    sha,
    state,
    context: "ai-pr-reviewer",
    description: description.slice(0, 140),
  });
}

/** Load `.aireview.yml` from the PR head, falling back to defaults. */
async function loadRepoConfig(
  context: PrContext,
  ref: string,
): Promise<ReviewConfig> {
  const { owner, repo } = context.repo();
  try {
    const res = await context.octokit.request(
      "GET /repos/{owner}/{repo}/contents/{path}",
      { owner, repo, path: ".aireview.yml", ref },
    );
    const data = res.data as { content?: string };
    if (data.content) {
      const raw = Buffer.from(data.content, "base64").toString("utf-8");
      return parseConfig(raw);
    }
  } catch (err) {
    const status = (err as { status?: number }).status;
    if (status !== 404) {
      context.log.warn({ err }, "config_load_failed");
    }
  }
  return DEFAULT_CONFIG;
}
