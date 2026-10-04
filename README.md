# Vigil

Vigil is a lightweight Node.js daemon that monitors UBB FMI practice announcement pages for both Bachelor's and Master's tracks. When a new opportunity is published, it dispatches a rich embed alert directly to a Discord channel via incoming webhook.

---

## Features

- **Cold-Start Protection**: Silently indexes existing posts on the initial run to prevent notification spam.
- **Persistent State**: Retains tracked URLs in a local volume-mounted JSON store across container restarts.
- **Lightweight Footprint**: Runs in Docker with minimal resource usage.

---

## Target Sources

- **Licență**: `[https://www.cs.ubbcluj.ro/anunturi/anunturi-studenti/anunturi-practica/](https://www.cs.ubbcluj.ro/anunturi/anunturi-studenti/anunturi-practica/)`
- **Master**: `[https://www.cs.ubbcluj.ro/anunturi/anunturi-studenti/anunturi-practica-nivel-master/](https://www.cs.ubbcluj.ro/anunturi/anunturi-studenti/anunturi-practica-nivel-master/)`

---

## Setup & Configuration

1. **Clone the repository:**
   ```bash
   git clone <repo_url> vigil
   cd vigil
   ```

2. **Configure environment variables:**
   Create a `.env` file in the root directory:
   ```env
   DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/.../...
   CRON_SCHEDULE=*/30 8-18 * * 1-5
   ```
   *Default schedule checks every 30 minutes, Monday through Friday, between 08:00 and 18:00.*

---

## Running with Docker

```bash
# Build and run container in background
docker compose up -d --build

# View logs
docker compose logs -f

# Stop the container
docker compose down
```

---

## Data Persistence

State is saved to `./data/seen_posts.json` and mounted into `/app/data` inside the container. To reset the index and force a cold start, stop the container, delete `data/seen_posts.json`, and restart.
EOF