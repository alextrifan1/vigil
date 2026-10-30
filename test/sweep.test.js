const { test } = require('node:test');
const assert = require('node:assert/strict');

const { sweep, createSweepRunner } = require('../src/sweep');

const silentLog = { log() {}, warn() {}, error() {} };

const { createStats } = require('../src/stats');
const newStats = createStats;
const post = (id) => ({ id, url: id, title: `Post ${id}`, category: 'Licență', date: '01.10.2026' });

/** In-memory replacement for the state file. */
function memoryState(initial = []) {
    let saved = new Set(initial);
    return {
        load: () => new Set(saved),
        save: (set) => { saved = new Set(set); },
        get seen() { return [...saved].sort(); }
    };
}

/** Fake notifier: records which posts it was called with, returns `result` (or result(post)). */
function fakeNotify(result = true) {
    const notify = async (p) => {
        notify.calls.push(p.id);
        return typeof result === 'function' ? result(p) : result;
    };
    notify.calls = [];
    return notify;
}

async function run({ posts, seen = [], notify = fakeNotify(), stats = newStats() }) {
    const state = memoryState(seen);
    await sweep({ scrape: async () => posts, notify, state, stats, log: silentLog });
    return { state, notify, stats };
}

// --- the rules ---

test('cold start indexes everything and sends nothing', async () => {
    const { state, notify } = await run({ posts: [post('a'), post('b')] });
    assert.deepEqual(notify.calls, []);
    assert.deepEqual(state.seen, ['a', 'b']);
});

test('only new posts are notified', async () => {
    const { state, notify } = await run({ posts: [post('a'), post('b'), post('c')], seen: ['a', 'b'] });
    assert.deepEqual(notify.calls, ['c']);
    assert.deepEqual(state.seen, ['a', 'b', 'c']);
});

test('a failed notification is not marked as seen, so it retries next sweep', async () => {
    const { state, notify } = await run({
        posts: [post('a'), post('b'), post('c')],
        seen: ['a'],
        notify: fakeNotify((p) => p.id !== 'b') // Discord rejects 'b'
    });
    assert.deepEqual(notify.calls, ['b', 'c']);
    assert.deepEqual(state.seen, ['a', 'c']);
});

test('notifications are sent one at a time, in order', async () => {
    const order = [];
    let inFlight = 0;
    const notify = async (p) => {
        inFlight++;
        assert.equal(inFlight, 1, 'two notifications overlapped');
        await new Promise((r) => setTimeout(r, 5));
        order.push(p.id);
        inFlight--;
        return true;
    };
    await run({ posts: [post('a'), post('b'), post('c')], seen: ['x'], notify });
    assert.deepEqual(order, ['a', 'b', 'c']);
});

// --- stats ---

test('updates heartbeat stats', async () => {
    const { stats } = await run({ posts: [post('a'), post('b')], seen: ['a'] });
    assert.equal(stats.sweeps, 1);
    assert.equal(stats.alerts, 1);
    assert.equal(stats.lastPostCount, 2);
    assert.equal(stats.trackedCount, 2);
    assert.ok(stats.lastSweepAt instanceof Date);
});

test('failed notifications do not count as alerts', async () => {
    const { stats } = await run({ posts: [post('a'), post('b')], seen: ['x'], notify: fakeNotify(false) });
    assert.equal(stats.alerts, 0);
});

// --- runner ---

test('runner skips a tick while the previous sweep is still running', async () => {
    let runs = 0;
    let finish;
    const slowSweep = () => { runs++; return new Promise((r) => { finish = r; }); };
    const runSweep = createSweepRunner(slowSweep, newStats(), silentLog);

    const first = runSweep();
    await runSweep(); // starts while the first is still running, must be skipped
    finish();
    await first;

    assert.equal(runs, 1);
});

test('runner counts a failed sweep instead of throwing', async () => {
    const stats = newStats();
    const runSweep = createSweepRunner(async () => { throw new Error('boom'); }, stats, silentLog);

    await runSweep();
    await runSweep();

    assert.equal(stats.failedSweeps, 2);
});

test('runner can run again after a failed sweep', async () => {
    let runs = 0;
    const runSweep = createSweepRunner(async () => { runs++; throw new Error('boom'); }, newStats(), silentLog);

    await runSweep();
    await runSweep();

    assert.equal(runs, 2); // the `finally` reset the flag
});