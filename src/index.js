require('dotenv').config();
const cron = require('node-cron');

const { loadConfig } = require('./config');
const { createSqliteStore } = require('./store');
const { createStats, resetPeriod, isHealthy } = require('./stats');
const { scrapeAll } = require('./scraper');
const { sendDiscordNotification, sendHeartbeat } = require('./discord');
const { sweep, createSweepRunner } = require('./sweep');
const { createHealthcheck } = require('./healthcheck');

// Entry point: only wiring and scheduling live here. All logic is in the modules.

let config;
try {
    config = loadConfig();
} catch (err) {
    console.error(`[Vigil Config]\n${err.message}`);
    process.exit(1);
}

const stats = createStats();
const store = createSqliteStore(config.dbFile, { legacyJsonPath: config.legacyStateFile });
const scrape = () => scrapeAll(config.targets);
const notify = (post) => sendDiscordNotification(config.webhookUrl, post);
const healthcheck = createHealthcheck(config.healthcheckUrl);

const runSweep = createSweepRunner(async () => {
    await sweep({ scrape, notify, state: store, history: store, stats });
    if (isHealthy(stats)) await healthcheck.ping();
}, stats);

runSweep();
cron.schedule(config.cronSchedule, runSweep, { timezone: config.timezone });

cron.schedule(config.heartbeatSchedule, async () => {
    const ok = await sendHeartbeat(config.webhookUrl, { ...stats, uptimeSeconds: process.uptime() });
    if (ok) resetPeriod(stats);
}, { timezone: config.timezone });

// Close the database cleanly when Docker stops the container (SIGTERM) or on Ctrl+C (SIGINT).
for (const signal of ['SIGTERM', 'SIGINT']) {
    process.on(signal, () => {
        console.log(`[Vigil] ${signal} received. Closing database and exiting.`);
        store.close();
        process.exit(0);
    });
}

console.log(`[Vigil Online] Sweep: "${config.cronSchedule}" | Heartbeat: "${config.heartbeatSchedule}" | Healthcheck: ${healthcheck.enabled ? 'on' : 'off'}`);