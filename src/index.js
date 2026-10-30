const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
require('dotenv').config();

const { loadConfig } = require('./config');
const { scrapeAll } = require('./scraper');
const { sendDiscordNotification, sendHeartbeat } = require('./discord');
const { sweep, createSweepRunner } = require('./sweep');

let config;
try {
    config = loadConfig();
} catch (err) {
    console.error(`[Vigil Config]\n${err.message}`);
    process.exit(1);
}

const {
    webhookUrl: WEBHOOK_URL,
    cronSchedule: CRON_SCHEDULE,
    heartbeatSchedule: HEARTBEAT_SCHEDULE,
    timezone: TIMEZONE,
    stateFile: STATE_FILE
} = config;
const DATA_DIR = path.dirname(STATE_FILE);

const stats = {
    sweeps: 0,
    failedSweeps: 0,
    alerts: 0,
    lastSweepAt: null,
    lastPostCount: 0,
    trackedCount: 0
};

function loadSeenPosts() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(STATE_FILE)) {
        try {
            const data = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
            return new Set(data);
        } catch {
            console.warn('[Vigil State] Invalid JSON in state file. Initializing fresh set.');
            return new Set();
        }
    }
    return new Set();
}

function saveSeenPosts(seenSet) {
    const tmpFile = `${STATE_FILE}.tmp`;
    fs.writeFileSync(tmpFile, JSON.stringify([...seenSet], null, 2), 'utf-8');
    fs.renameSync(tmpFile, STATE_FILE);
}

// Wire the real dependencies into the sweep
const state = { load: loadSeenPosts, save: saveSeenPosts };
const scrape = () => scrapeAll(config.targets);
const notify = (post) => sendDiscordNotification(WEBHOOK_URL, post);

const runSweep = createSweepRunner(
    () => sweep({ scrape, notify, state, stats }),
    stats
);

runSweep();
cron.schedule(CRON_SCHEDULE, runSweep, { timezone: TIMEZONE });

cron.schedule(HEARTBEAT_SCHEDULE, async () => {
    const ok = await sendHeartbeat(WEBHOOK_URL, { ...stats, uptimeSeconds: process.uptime() });
    if (ok) {
        stats.sweeps = 0;
        stats.failedSweeps = 0;
        stats.alerts = 0;
    }
}, { timezone: TIMEZONE });

console.log(`[Vigil Online] Sweep: "${CRON_SCHEDULE}" | Heartbeat: "${HEARTBEAT_SCHEDULE}"`);