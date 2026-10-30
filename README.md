# Vigil

![CI](https://github.com/alextrifan1/vigil/actions/workflows/ci.yml/badge.svg)

A small Node.js daemon that watches the UBB FMI practice boards ([Licență](https://www.cs.ubbcluj.ro/anunturi/anunturi-studenti/anunturi-practica/) and [Master](https://www.cs.ubbcluj.ro/anunturi/anunturi-studenti/anunturi-practica-nivel-master/)) and posts new announcements to Discord.

## Features

- Discord alert for every new post (title, link, board, date)
- No spam on first run: existing posts are indexed silently
- Failed alerts are retried on the next sweep
- Posts on both boards are sent once, labelled `Licență + Master`
- Weekly heartbeat report; orange when something looks wrong

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

Schedules run in **Europe/Bucharest** time. Invalid values stop Vigil at startup with a clear error.

## Run

```bash
docker compose up -d --build   # Docker
pnpm install && pnpm start     # locally (Node 20+)
```

## Test

```bash
pnpm test
```

Tests use Node's built-in runner and run in CI on every push. Inline variables override `.env`, which helps when testing by hand:

```bash
CRON_SCHEDULE="* * * * *" HEARTBEAT_SCHEDULE="* * * * *" pnpm start
```

## Structure

```
src/
  index.js     wiring and scheduling
  config.js    env parsing and validation
  sweep.js     core logic (new posts, cold start, retries)
  parse.js     HTML → posts (pure)
  embeds.js    Discord embeds (pure)
  scraper.js   fetches the boards
  discord.js   sends to the webhook
  state.js     seen posts on disk
  stats.js     heartbeat counters
```

## State

Seen posts are stored in `data/seen_posts.json` (mounted into the container). Delete it to force a fresh cold start.