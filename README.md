# Vigil

Vigil is a lightweight Node.js daemon that monitors the UBB FMI practice announcement boards for both Bachelor's and Master's tracks. When a new opportunity is published, it sends a rich embed alert to a Discord channel through an incoming webhook, and once a week it reports that it is still running.

---

## Features

- **New-post alerts**: Each new announcement is sent as a Discord embed with its title, link, board and publication date.
- **Cold-start protection**: On the first run, existing posts are indexed silently, so you don't get a burst of notifications.
- **No lost alerts**: A post is marked as seen only after Discord accepts the message. If a send fails, it is retried on the next sweep.
- **Cross-posted announcements**: Posts that appear on both boards are sent once, labelled `Licență + Master`.
- **Weekly heartbeat**: A weekly report with sweep, alert and uptime stats. It turns orange when something looks wrong, for example when no posts could be parsed.
- **Persistent state**: Seen posts are stored in a volume-mounted JSON file and written atomically, so they survive container restarts.
- **Lightweight footprint**: Runs in a small Alpine-based Docker image as a non-root user.

---

## Target Sources

- **Licență**: [anunturi-practica](https://www.cs.ubbcluj.ro/anunturi/anunturi-studenti/anunturi-practica/)
- **Master**: [anunturi-practica-nivel-master](https://www.cs.ubbcluj.ro/anunturi/anunturi-studenti/anunturi-practica-nivel-master/)

---

## Configuration

Create a `.env` file in the project root:

```env
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/.../...
CRON_SCHEDULE=*/30 8-18 * * 1-5
HEARTBEAT_SCHEDULE=0 9 * * 1
```

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `DISCORD_WEBHOOK_URL` | Yes | (none) | Discord incoming webhook. Vigil exits on startup if it is missing. |
| `CRON_SCHEDULE` | No | `*/30 8-18 * * 1-5` | When to check the boards. Every 30 minutes, Monday to Friday, 08:00–18:00. |
| `HEARTBEAT_SCHEDULE` | No | `0 9 * * 1` | When to send the weekly report. Monday at 09:00. |

All schedules use standard 5-field cron syntax and run in **Europe/Bucharest** time, regardless of the host or container timezone.

---

## Running with Docker

```bash
git clone https://github.com/alextrifan1/vigil.git
cd vigil

# Build and run in the background
docker compose up -d --build

# View logs
docker compose logs -f

# Stop the container
docker compose down
```

## Running locally

Requires Node.js 20+ and pnpm (`corepack enable` if pnpm isn't installed).

```bash
pnpm install
pnpm start
```

---

## Weekly Heartbeat

Every week Vigil posts a report to the same channel with:

- number of sweeps and alerts since the last report
- number of tracked posts
- time of the last sweep
- process uptime (a low uptime means the container restarted recently)

The report is **green** when everything looks normal and **orange** when no sweeps ran, a sweep failed, or the last sweep found 0 posts (usually a sign the board's layout changed).

If a weekly report doesn't arrive at all, Vigil (or the machine it runs on) is down.

---

## Data Persistence

State is stored in `./data/seen_posts.json`, mounted at `/app/data` inside the container.

To reset the index and force a cold start:

```bash
docker compose down
rm -f data/seen_posts.json
docker compose up -d
```

---

## Testing Tips

Values set inline override `.env`, which makes quick tests easy:

```bash
# Sweep every minute
CRON_SCHEDULE="* * * * *" pnpm start

# Get a heartbeat report every minute
HEARTBEAT_SCHEDULE="* * * * *" pnpm start
```

To simulate a new announcement, delete one URL from `data/seen_posts.json` while Vigil is running. The next sweep should send exactly one alert.

Use a separate Discord channel and webhook for testing.