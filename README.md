# ai-pr-reviewer

A GitHub PR reviewer powered by Claude. Watches a repository via webhooks,
reviews opened/updated pull requests with configurable rules, and posts a
summary plus inline comments with one-click suggested fixes. Critical findings
set a failing commit status to block merges.

Built with [Probot](https://probot.github.io) (GitHub App framework) and the
Anthropic TypeScript SDK.

## What this is (and isn't)

**Is:** a focused, production-shaped service demonstrating agentic workflow,
GitHub API integration, prompt engineering, and offline evaluation. A 20–25
hour portfolio project.

**Isn't:** a replacement for human review, a generic linter, or a full DevTools
product (no dashboard, multi-provider support, or fine-tuning).

## Features

- 🪝 Webhook-driven, real-time review on PR open/update (via Probot)
- 🎯 Structured findings via Anthropic tool-use — typed and validated with Zod,
  not parsed out of prose
- 💡 One-click fixes posted as GitHub `suggestion` blocks
- 🚦 Merge gating: critical findings set a failing commit status
- 📝 Per-repo config via `.aireview.yml` (severity thresholds, ignore paths,
  custom natural-language rules)
- 📊 Eval harness *(coming Day 5)* — fixture PRs with known issues to measure
  precision/recall across prompt and model changes

## Architecture

```
GitHub PR event ─► Probot (verifies signature, exchanges tokens, routes event)
                                   │
                                   ▼  authenticated Octokit handed to our handler
                        fetch diff + .aireview.yml
                                   │
                                   ▼
                       parse diff into per-file chunks
                                   │
                                   ▼ (per file)
        Claude tool-use: report_finding × N, then submit_review
                                   │
                                   ▼
              format inline comments + summary body
                                   │
                                   ▼
              POST review + set commit status (pass/fail)
```

Probot removes the boilerplate the hand-rolled version needed: HMAC signature
verification, the App-JWT → installation-token exchange, and event routing are
all handled before our code runs.

## Quickstart

See [`docs/SETUP.md`](docs/SETUP.md) for full setup (Probot can auto-register
the GitHub App for you). Short version:

```bash
npm install
cp .env.example .env      # add ANTHROPIC_API_KEY; Probot can fill the rest
npm run dev               # first run walks you through App registration
```

Test the review pipeline without webhooks:

```bash
export GITHUB_TOKEN=ghp_... ANTHROPIC_API_KEY=sk-ant-...
npm run review -- --owner you --repo somerepo --number 42   # add --post to publish
```

## Configuration

Drop `.aireview.yml` at the root of any repo where the App is installed. See
the annotated example in this repo's root.

| Field | Default | Purpose |
|-------|---------|---------|
| `model` | (env default) | Override the model for this repo |
| `severityThreshold` | `low` | Drop findings below this |
| `blockOn` | `critical` | Failing status at or above this |
| `ignorePaths` | `node_modules`, `dist`, … | Skip matching files |
| `rules` | `[]` | List of `{ name, prompt, severity }` |
| `maxFilesPerReview` | `30` | Bail out if the PR is bigger |

## Development

```bash
npm run dev          # hot-reloading server (tsx watch)
npm test             # vitest
npm run typecheck    # tsc --noEmit
npm run lint         # eslint + prettier check
npm run build        # compile to dist/
```

## Tech stack

TypeScript (ESM, strict), Probot 14, Anthropic SDK, Zod (schema + validation),
parse-diff, yaml. Tooling: vitest, eslint, prettier, tsx. Deploy: Docker.

## Roadmap

- [x] Probot app + PR event handling
- [x] Diff parsing & per-file chunking
- [x] LLM reviewer with tool-use structured output
- [x] Inline comments + summary + commit status
- [x] `.aireview.yml` config loading
- [ ] Eval harness with fixture PRs and precision/recall metrics
- [ ] Idempotency: don't re-comment the same finding on PR update
- [ ] Parallelize per-file review with bounded concurrency
- [ ] Prompt caching for the system prompt
- [ ] Deployment hardening

## License

MIT
