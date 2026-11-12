# Vigil

![CI](https://github.com/alextrifan1/vigil/actions/workflows/ci.yml/badge.svg)

A small Node.js daemon that watches the UBB FMI practice boards ([Licență](https://www.cs.ubbcluj.ro/anunturi/anunturi-studenti/anunturi-practica/) and [Master](https://www.cs.ubbcluj.ro/anunturi/anunturi-studenti/anunturi-practica-nivel-master/)) and posts new announcements to Discord.

## Features

- Discord alert for every new post: title, excerpt, board and exact publish time
- Reads the boards' RSS feeds, falls back to the HTML pages if a feed fails
- No spam on first run: existing posts are indexed silently
- Failed alerts are retried on the next sweep
- Posts on both boards are sent once, labelled `Licență + Master`
- Weekly heartbeat report in Discord; orange when something looks wrong
- Optional [Healthchecks.io](https://healthchecks.io) ping, so you get an email if Vigil goes silent

## Setup

Create `.env` in the project root:

```env
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/.../...
```

| Variable | Default | |
| --- | --- | --- |
| `DISCORD_WEBHOOK_URL` | (required) | Discord webhook |
| `CRON_SCHEDULE` | `*/30 8-18 * * 1-5` | When to check the boards |
| `HEARTBEAT_SCHEDULE` | `0 9 * * 1` | When to send the weekly report |
| `HEALTHCHECK_URL` | (off) | Healthchecks.io ping URL, pinged after each healthy sweep |

Schedules run in **Europe/Bucharest** time. Invalid values stop Vigil at startup with a clear error.

For Healthchecks, give the check the same cron schedule and time zone as `CRON_SCHEDULE`, with a grace time of about 15 minutes.

## Run

```bash
docker compose up -d --build   # Docker
pnpm install && pnpm start     # locally (Node 20+)
```

## Test

```bash
pnpm test
```

Tests use Node's built-in runner, with saved copies of the real feeds and pages as fixtures. Inline variables override `.env`, which helps when testing by hand:

```bash
CRON_SCHEDULE="* * * * *" HEARTBEAT_SCHEDULE="* * * * *" pnpm start
```

## Deploy

Every push to `main` runs the tests and the Docker build. If both pass, GitHub Actions connects to the server over SSH and runs `git pull` and `docker compose up -d --build`.

The deploy key on the server is restricted to that single command, so it can't open a shell. The workflow can also be run manually from the Actions tab.

Required repository secrets: `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`, `DEPLOY_KNOWN_HOSTS`.

## Structure

```
src/
  index.js        wiring and scheduling
  config.js       env parsing, validation, board list
  sweep.js        core logic (new posts, cold start, retries)
  parse.js        RSS and HTML → posts (pure)
  embeds.js       Discord embeds (pure)
  scraper.js      fetches each board, feed first, HTML as fallback
  discord.js      sends to the webhook
  healthcheck.js  Healthchecks.io ping
  state.js        seen posts on disk
  stats.js        heartbeat counters
```

## State

Seen posts are stored in `data/seen_posts.json` (mounted into the container), keyed by WordPress post ID (`post-69438`). Delete it to force a fresh cold start.