require('dotenv').config();
const cron = require('node-cron');

const { loadConfig } = require('./config');
const { createFileState } = require('./state');
const { createStats, resetPeriod } = require('./stats');
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

const stats = createStats();
const state = createFileState(config.stateFile);
const scrape = () => scrapeAll(config.targets);
const notify = (post) => sendDiscordNotification(config.webhookUrl, post);

const runSweep = createSweepRunner(
    () => sweep({ scrape, notify, state, stats }),
    stats
);

runSweep();
cron.schedule(config.cronSchedule, runSweep, { timezone: config.timezone });

cron.schedule(config.heartbeatSchedule, async () => {
    const ok = await sendHeartbeat(config.webhookUrl, { ...stats, uptimeSeconds: process.uptime() });
    if (ok) resetPeriod(stats);
}, { timezone: config.timezone });

console.log(`[Vigil Online] Sweep: "${config.cronSchedule}" | Heartbeat: "${config.heartbeatSchedule}"`);