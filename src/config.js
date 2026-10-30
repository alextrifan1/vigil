const path = require('path');
const cron = require('node-cron');

const TARGETS = [
    {
        name: 'Licență',
        url: 'https://www.cs.ubbcluj.ro/anunturi/anunturi-studenti/anunturi-practica/'
    },
    {
        name: 'Master',
        url: 'https://www.cs.ubbcluj.ro/anunturi/anunturi-studenti/anunturi-practica-nivel-master/'
    }
];

const DEFAULTS = {
    cronSchedule: '*/30 8-18 * * 1-5',
    heartbeatSchedule: '0 9 * * 1',
    timezone: 'Europe/Bucharest',
    stateFile: path.join(__dirname, '../data/seen_posts.json')
};


/**
 * Builds the config from environment variables and validates it.
 * Throws one error listing every problem, so a bad .env fails loudly at startup.
 */
function loadConfig(env = process.env) {
    const config = {
        webhookUrl: env.DISCORD_WEBHOOK_URL,
        cronSchedule: env.CRON_SCHEDULE || DEFAULTS.cronSchedule,
        heartbeatSchedule: env.HEARTBEAT_SCHEDULE || DEFAULTS.heartbeatSchedule,
        timezone: DEFAULTS.timezone,
        stateFile: DEFAULTS.stateFile,
        targets: TARGETS
    };

    const errors = [];
    if (!config.webhookUrl) {
        errors.push('DISCORD_WEBHOOK_URL is required.');
    }
    if (!cron.validate(config.cronSchedule)) {
        errors.push(`CRON_SCHEDULE is not a valid cron expression: "${config.cronSchedule}"`);
    }
    if (!cron.validate(config.heartbeatSchedule)) {
        errors.push(`HEARTBEAT_SCHEDULE is not a valid cron expression: "${config.heartbeatSchedule}"`);
    }

    if (errors.length > 0) {
        throw new Error(errors.join('\n'));
    }
    return config;
}

module.exports = { loadConfig, TARGETS, DEFAULTS };