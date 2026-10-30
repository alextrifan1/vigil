const { test } = require('node:test');
const assert = require('node:assert/strict');

const { loadConfig, DEFAULTS, TARGETS } = require('../src/config');

const minimal = { DISCORD_WEBHOOK_URL: 'https://hook' };

test('uses defaults when only the webhook is set', () => {
    const config = loadConfig(minimal);
    assert.equal(config.webhookUrl, 'https://hook');
    assert.equal(config.cronSchedule, DEFAULTS.cronSchedule);
    assert.equal(config.heartbeatSchedule, DEFAULTS.heartbeatSchedule);
    assert.equal(config.timezone, 'Europe/Bucharest');
    assert.deepEqual(config.targets, TARGETS);
});

test('env values override the defaults', () => {
    const config = loadConfig({ ...minimal, CRON_SCHEDULE: '* * * * *', HEARTBEAT_SCHEDULE: '0 17 * * 5' });
    assert.equal(config.cronSchedule, '* * * * *');
    assert.equal(config.heartbeatSchedule, '0 17 * * 5');
});

test('empty values fall back to the defaults, like docker-compose :-', () => {
    const config = loadConfig({ ...minimal, CRON_SCHEDULE: '', HEARTBEAT_SCHEDULE: '' });
    assert.equal(config.cronSchedule, DEFAULTS.cronSchedule);
    assert.equal(config.heartbeatSchedule, DEFAULTS.heartbeatSchedule);
});

test('a missing webhook is rejected', () => {
    assert.throws(() => loadConfig({}), /DISCORD_WEBHOOK_URL is required/);
});

test('an invalid cron expression is rejected', () => {
    assert.throws(() => loadConfig({ ...minimal, CRON_SCHEDULE: 'every 5 min' }), /CRON_SCHEDULE is not a valid/);
});

test('all problems are reported at once', () => {
    assert.throws(
        () => loadConfig({ CRON_SCHEDULE: 'nope', HEARTBEAT_SCHEDULE: '99 99 * * *' }),
        (err) => {
            assert.match(err.message, /DISCORD_WEBHOOK_URL/);
            assert.match(err.message, /CRON_SCHEDULE/);
            assert.match(err.message, /HEARTBEAT_SCHEDULE/);
            return true;
        }
    );
});

test('both boards are configured', () => {
    assert.deepEqual(TARGETS.map((t) => t.name), ['Licență', 'Master']);
});