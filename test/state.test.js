const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { createFileState } = require('../src/state');
const { createStats, resetPeriod } = require('../src/stats');

const silentLog = { log() {}, warn() {}, error() {} };

/** A path inside a fresh temp folder, so tests never touch data/. */
function tempStateFile() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vigil-'));
    return path.join(dir, 'data', 'seen_posts.json');
}

test('starts empty and creates the data folder', () => {
    const file = tempStateFile();
    const state = createFileState(file, silentLog);
    assert.equal(state.load().size, 0);
    assert.ok(fs.existsSync(path.dirname(file)));
});

test('what is saved is loaded back, and no .tmp file is left behind', () => {
    const file = tempStateFile();
    const state = createFileState(file, silentLog);
    state.load();
    state.save(new Set(['a', 'b']));

    assert.deepEqual([...createFileState(file, silentLog).load()].sort(), ['a', 'b']);
    assert.ok(!fs.existsSync(`${file}.tmp`));
});

test('reads the array format written by earlier versions', () => {
    const file = tempStateFile();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(['https://x.ro/1', 'https://x.ro/2']));

    assert.equal(createFileState(file, silentLog).load().size, 2);
});

test('a corrupted file falls back to an empty set', () => {
    const file = tempStateFile();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, '{broken');

    assert.equal(createFileState(file, silentLog).load().size, 0);
});

test('resetPeriod clears weekly counters but keeps current state', () => {
    const stats = { ...createStats(), sweeps: 40, failedSweeps: 1, alerts: 3, lastPostCount: 17, trackedCount: 17 };
    resetPeriod(stats);

    assert.equal(stats.sweeps, 0);
    assert.equal(stats.failedSweeps, 0);
    assert.equal(stats.alerts, 0);
    assert.equal(stats.lastPostCount, 17);
    assert.equal(stats.trackedCount, 17);
});