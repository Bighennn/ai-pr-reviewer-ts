# GitHub App Setup

Getting the reviewer running against a real repo. Probot streamlines a lot of
this — it can even register the GitHub App for you on first run.

## Option A: Let Probot create the App for you (recommended)

Probot has a "manifest flow" that registers the GitHub App and fills in your
`.env` automatically.

```bash
npm install
cp .env.example .env
# Add your ANTHROPIC_API_KEY to .env. Leave APP_ID / PRIVATE_KEY / WEBHOOK_SECRET
# blank for now — Probot will fill them in.

npm run dev
```

On first run with no credentials, Probot prints a URL (usually
`http://localhost:3000`). Open it and follow the flow:

1. Click through to register a new GitHub App.
2. GitHub redirects back; Probot writes `APP_ID`, `PRIVATE_KEY`, and
   `WEBHOOK_SECRET` into your `.env` automatically.
3. Install the App on a test repo when prompted.

Probot also manages the webhook proxy (smee.io) automatically in dev, so you
don't need a separate tunnel — just make sure `WEBHOOK_PROXY_URL` is set (the
manifest flow can generate one, or grab a channel from https://smee.io).

That's it. Skip to "Verify" below.

## Option B: Register the App manually

If you prefer to set it up by hand:

1. Go to https://github.com/settings/apps/new
2. Fill in:
   - **GitHub App name**: `your-username-ai-reviewer` (must be globally unique)
   - **Homepage URL**: anything
   - **Webhook URL**: your smee.io channel URL (dev) or deployed URL (prod)
   - **Webhook secret**: generate one with
     `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
3. **Permissions**:
   - Pull requests: Read & write
   - Contents: Read-only
   - Commit statuses: Read & write
   - Metadata: Read-only (auto)
4. **Subscribe to events**: Pull request
5. Create the App, then **generate a private key** (downloads a `.pem`).
6. Move the key into the project root as `github-app.private-key.pem`.
7. Fill in `.env`: `APP_ID`, `PRIVATE_KEY_PATH`, `WEBHOOK_SECRET`,
   `WEBHOOK_PROXY_URL` (your smee channel), `ANTHROPIC_API_KEY`.
8. Install the App on a test repo (App settings → Install App).

## Verify

```bash
npm run dev
```

Open a PR on the repo where you installed the App. Within ~30 seconds you
should see a review appear.

You can also test the review pipeline without webhooks at all, using a
personal access token:

```bash
export GITHUB_TOKEN=ghp_...
export ANTHROPIC_API_KEY=sk-ant-...
npm run review -- --owner you --repo somerepo --number 42
# add --post to actually publish the review
```

## Production deploy

Build the container and deploy anywhere that runs Node (Fly.io, Railway,
Render, a VM). Set these as secrets in your host: `APP_ID`, `PRIVATE_KEY`
(the PEM contents, not a path), `WEBHOOK_SECRET`, `ANTHROPIC_API_KEY`. Then
point the GitHub App's webhook URL at `https://your-host/` (Probot serves the
webhook at the root path).

```bash
docker build -t ai-pr-reviewer .
docker run -p 3000:3000 --env-file .env.production ai-pr-reviewer
```

## Troubleshooting

- **Webhook deliveries failing**: GitHub App → Advanced → Recent Deliveries
  shows each payload and the response your server returned. A 401 means the
  webhook secret doesn't match.
- **404 fetching the diff**: the App isn't installed on the repo, or lacks
  Pull requests permission.
- **No review appears**: check `npm run dev` logs; confirm the smee proxy is
  connected (Probot logs the proxy URL on startup).
