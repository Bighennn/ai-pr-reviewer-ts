import { parseArgs } from "node:util";
import Anthropic from "@anthropic-ai/sdk";
import { Octokit } from "@octokit/core";
import { parsePrDiff } from "./reviewer/diff.js";
import { LLMReviewer } from "./reviewer/reviewer.js";
import { DEFAULT_CONFIG, parseConfig } from "./config/config.js";

/**
 * Local-dev CLI: review a PR without webhooks.
 *
 *   npm run review -- --owner foo --repo bar --number 42
 *
 * Uses a personal access token (GITHUB_TOKEN) rather than the App auth flow.
 * Prints findings as JSON by default; pass --post to publish the review.
 *
 * Note: Probot bundles Octokit, but for the standalone CLI we use the core
 * Octokit directly with a PAT — simpler than booting a Probot context.
 */

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      owner: { type: "string" },
      repo: { type: "string" },
      number: { type: "string" },
      post: { type: "boolean", default: false },
      model: { type: "string" },
    },
  });

  if (!values.owner || !values.repo || !values.number) {
    console.error(
      "usage: npm run review -- --owner OWNER --repo REPO --number N [--post] [--model MODEL]",
    );
    process.exit(2);
  }

  const githubToken = process.env.GITHUB_TOKEN;
  if (!githubToken) {
    console.error("error: GITHUB_TOKEN env var required");
    process.exit(2);
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("error: ANTHROPIC_API_KEY env var required");
    process.exit(2);
  }

  const owner = values.owner;
  const repo = values.repo;
  const number = Number(values.number);

  const octokit = new Octokit({ auth: githubToken });

  // Resolve head SHA and load optional config.
  const prRes = await octokit.request(
    "GET /repos/{owner}/{repo}/pulls/{pull_number}",
    { owner, repo, pull_number: number },
  );
  const headSha = (prRes.data as { head: { sha: string } }).head.sha;

  let config = DEFAULT_CONFIG;
  try {
    const cfgRes = await octokit.request(
      "GET /repos/{owner}/{repo}/contents/{path}",
      { owner, repo, path: ".aireview.yml", ref: headSha },
    );
    const data = cfgRes.data as { content?: string };
    if (data.content) {
      config = parseConfig(
        Buffer.from(data.content, "base64").toString("utf-8"),
      );
    }
  } catch {
    // No config file; use defaults.
  }

  // Fetch the diff.
  const diffRes = await octokit.request(
    "GET /repos/{owner}/{repo}/pulls/{pull_number}",
    {
      owner,
      repo,
      pull_number: number,
      headers: { accept: "application/vnd.github.v3.diff" },
    },
  );
  const diffText = diffRes.data as unknown as string;

  const chunks = parsePrDiff(diffText);
  console.error(`[cli] parsed ${chunks.length} file(s)`);

  const reviewer = new LLMReviewer(new Anthropic({ apiKey }), {
    model: values.model ?? process.env.ANTHROPIC_MODEL,
  });
  const result = await reviewer.reviewPr(chunks, config);

  if (values.post) {
    const { formatInlineComment, formatSummaryBody } =
      await import("./github/comments.js");
    await octokit.request(
      "POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews",
      {
        owner,
        repo,
        pull_number: number,
        commit_id: headSha,
        body: formatSummaryBody(result),
        event: "COMMENT",
        comments: result.findings.map(formatInlineComment),
      },
    );
    console.error(
      `[cli] posted review with ${result.findings.length} finding(s)`,
    );
  } else {
    console.log(JSON.stringify(result, null, 2));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
