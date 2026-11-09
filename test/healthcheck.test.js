const { test } = require('node:test');
const assert = require('node:assert/strict');

const { createHealthcheck } = require('../src/healthcheck');
const { createStats, isHealthy } = require('../src/stats');
const { loadConfig } = require('../src/config');

const silentLog = { log() {}, warn() {}, error() {} };

test('pings the configured URL', async () => {
    const calls = [];
    const hc = createHealthcheck('https://hc-ping.com/abc', { post: async (url) => { calls.push(url); }, log: silentLog });

    assert.equal(await hc.ping(), true);
    assert.deepEqual(calls, ['https://hc-ping.com/abc']);
    assert.equal(hc.enabled, true);
});

test('does nothing when no URL is configured', async () => {
    const calls = [];
    const hc = createHealthcheck(null, { post: async (url) => { calls.push(url); }, log: silentLog });

    assert.equal(await hc.ping(), false);
    assert.deepEqual(calls, []);
    assert.equal(hc.enabled, false);
});

test('a failed ping returns false instead of throwing', async () => {
    const hc = createHealthcheck('https://hc-ping.com/abc', {
        post: async () => { throw new Error('getaddrinfo EAI_AGAIN hc-ping.com'); },
        log: silentLog
    });
    assert.equal(await hc.ping(), false);
});

test('a sweep is healthy only when it found posts', () => {
    assert.equal(isHealthy({ ...createStats(), lastPostCount: 16 }), true);
    assert.equal(isHealthy({ ...createStats(), lastPostCount: 0 }), false);
});

test('config: healthcheck is optional', () => {
    assert.equal(loadConfig({ DISCORD_WEBHOOK_URL: 'https://hook' }).healthcheckUrl, null);
});

test('config: healthcheck URL must be https', () => {
    assert.throws(
        () => loadConfig({ DISCORD_WEBHOOK_URL: 'https://hook', HEALTHCHECK_URL: 'hc-ping.com/abc' }),
        /HEALTHCHECK_URL must be an https/
    );
});