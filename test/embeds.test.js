const { test } = require('node:test');
const assert = require('node:assert/strict');

const { buildPostEmbed, buildHeartbeatEmbed, heartbeatWarnings, formatUptime, COLORS } = require('../src/embeds');

const NOW = new Date('2026-10-30T12:00:00Z');
const post = { id: 'u', url: 'https://x.ro/p', title: 'Practică', category: 'Master', date: '01.10.2026' };
const healthyStats = { sweeps: 40, failedSweeps: 0, alerts: 2, lastSweepAt: NOW, lastPostCount: 17, trackedCount: 17 };

// --- post embed ---

test('post embed contains title, link, board and date', () => {
    const embed = buildPostEmbed(post, NOW);
    assert.equal(embed.title, 'Practică');
    assert.equal(embed.url, 'https://x.ro/p');
    assert.deepEqual(embed.fields, [
        { name: 'Board', value: 'Master', inline: true },
        { name: 'Date', value: '01.10.2026', inline: true }
    ]);
    assert.equal(embed.timestamp, '2026-10-30T12:00:00.000Z');
});

test('Master and cross-posted items are gold, Licență is grey', () => {
    assert.equal(buildPostEmbed({ ...post, category: 'Master' }).color, COLORS.master);
    assert.equal(buildPostEmbed({ ...post, category: 'Licență + Master' }).color, COLORS.master);
    assert.equal(buildPostEmbed({ ...post, category: 'Licență' }).color, COLORS.licenta);
});

test('long titles are cut to 250 characters with "..."', () => {
    const embed = buildPostEmbed({ ...post, title: 'a'.repeat(300) });
    assert.equal(embed.title.length, 250);
    assert.ok(embed.title.endsWith('...'));
});

test('short titles are left untouched', () => {
    assert.equal(buildPostEmbed({ ...post, title: 'a'.repeat(250) }).title, 'a'.repeat(250));
});

// --- heartbeat ---

test('no warnings when everything is normal', () => {
    assert.deepEqual(heartbeatWarnings(healthyStats), []);
});

test('each problem produces its own warning', () => {
    assert.equal(heartbeatWarnings({ ...healthyStats, sweeps: 0 }).length, 1);
    assert.equal(heartbeatWarnings({ ...healthyStats, failedSweeps: 3 }).length, 1);
    assert.equal(heartbeatWarnings({ ...healthyStats, lastPostCount: 0 }).length, 1);
    assert.equal(heartbeatWarnings({ ...healthyStats, sweeps: 0, failedSweeps: 3, lastPostCount: 0 }).length, 3);
});

test('healthy heartbeat is green', () => {
    const embed = buildHeartbeatEmbed(healthyStats, 3600, NOW);
    assert.equal(embed.color, COLORS.healthy);
    assert.match(embed.title, /all good/);
});

test('unhealthy heartbeat is orange and lists the problems', () => {
    const embed = buildHeartbeatEmbed({ ...healthyStats, failedSweeps: 2, lastPostCount: 0 }, 3600, NOW);
    assert.equal(embed.color, COLORS.warning);
    assert.match(embed.description, /2 sweep\(s\) failed/);
    assert.match(embed.description, /0 posts/);
});

test('last sweep is a Discord relative timestamp, or "never"', () => {
    const field = (stats) => buildHeartbeatEmbed(stats, 0, NOW).fields.find((f) => f.name === 'Last sweep').value;
    assert.equal(field(healthyStats), `<t:${NOW.getTime() / 1000}:R>`);
    assert.equal(field({ ...healthyStats, lastSweepAt: null }), 'never');
});

test('formatUptime shows days and hours', () => {
    assert.equal(formatUptime(0), '0d 0h');
    assert.equal(formatUptime(3599), '0d 0h');
    assert.equal(formatUptime(90061), '1d 1h');
});