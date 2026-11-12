const { test } = require('node:test');
const assert = require('node:assert/strict');

const { createStats, resetPeriod } = require('../src/stats');

test('resetPeriod clears weekly counters but keeps current state', () => {
    const stats = { ...createStats(), sweeps: 40, failedSweeps: 1, alerts: 3, lastPostCount: 17, trackedCount: 17 };
    resetPeriod(stats);

    assert.equal(stats.sweeps, 0);
    assert.equal(stats.failedSweeps, 0);
    assert.equal(stats.alerts, 0);
    assert.equal(stats.lastPostCount, 17);
    assert.equal(stats.trackedCount, 17);
});