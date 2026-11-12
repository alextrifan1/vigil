const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { createSqliteStore } = require('../src/store');

const silentLog = { log() {}, warn() {}, error() {} };

/** A fresh temp folder per test, so tests never touch data/. */
function tempDir() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'vigil-store-'));
}

/** A store whose clock we control. */
function memoryStore(options = {}) {
    let clock = new Date('2026-11-12T10:00:00Z');
    const store = createSqliteStore(':memory:', { now: () => clock, log: silentLog, ...options });
    store.setClock = (iso) => { clock = new Date(iso); };
    return store;
}

const feedPost = {
    id: 'post-69438',
    url: 'https://www.cs.ubbcluj.ro/practica-backend-java-2026/',
    title: 'Practică Backend Java',
    category: 'Licență + Master',
    publishedAt: new Date('2026-07-28T08:26:12Z'),
    date: null,
    excerpt: 'Stagii de practică pentru studenți.'
};

const htmlPost = {
    id: 'post-69120',
    url: 'https://www.cs.ubbcluj.ro/internship-data-engineering/',
    title: 'Internship Data Engineering',
    category: 'Licență',
    publishedAt: null,
    date: '15.07.2026',
    excerpt: ''
};

// --- seen (state) ---

test('a new store has nothing seen', () => {
    assert.equal(memoryStore().load().size, 0);
});

test('saved IDs are loaded back', () => {
    const store = memoryStore();
    store.save(new Set(['post-1', 'post-2']));
    assert.deepEqual([...store.load()].sort(), ['post-1', 'post-2']);
});

test('saving the same ID twice keeps one entry', () => {
    const store = memoryStore();
    store.save(new Set(['post-1']));
    store.save(new Set(['post-1', 'post-2']));
    assert.equal(store.load().size, 2);
});

test('data survives closing and reopening the file', () => {
    const dbPath = path.join(tempDir(), 'data', 'vigil.db');
    const first = createSqliteStore(dbPath, { log: silentLog });
    first.save(new Set(['post-1']));
    first.record([feedPost]);
    first.close();

    const second = createSqliteStore(dbPath, { log: silentLog });
    assert.deepEqual([...second.load()], ['post-1']);
    assert.equal(second.history().length, 1);
    second.close();
});

// --- posts (history) ---

test('record stores every field of a feed post', () => {
    const store = memoryStore();
    store.record([feedPost]);

    assert.deepEqual(store.history(), [{
        id: 'post-69438',
        url: 'https://www.cs.ubbcluj.ro/practica-backend-java-2026/',
        title: 'Practică Backend Java',
        boards: 'Licență + Master',
        excerpt: 'Stagii de practică pentru studenți.',
        published_at: '2026-07-28T08:26:12.000Z',
        date_text: null,
        first_seen_at: '2026-11-12T10:00:00.000Z',
        last_seen_at: '2026-11-12T10:00:00.000Z'
    }]);
});

test('record stores HTML posts with their date text and no excerpt', () => {
    const store = memoryStore();
    store.record([htmlPost]);
    const [row] = store.history();

    assert.equal(row.published_at, null);
    assert.equal(row.date_text, '15.07.2026');
    assert.equal(row.excerpt, null);
});

test('seeing a post again updates it but keeps when it was first seen', () => {
    const store = memoryStore();
    store.record([feedPost]);
    store.setClock('2026-11-13T10:00:00Z');
    store.record([{ ...feedPost, title: 'Practică Backend Java (actualizat)' }]);

    const [row] = store.history();
    assert.equal(row.title, 'Practică Backend Java (actualizat)');
    assert.equal(row.first_seen_at, '2026-11-12T10:00:00.000Z');
    assert.equal(row.last_seen_at, '2026-11-13T10:00:00.000Z');
});

test('a later HTML fallback does not erase the exact time or excerpt from the feed', () => {
    const store = memoryStore();
    store.record([feedPost]);
    store.record([{ ...feedPost, publishedAt: null, date: '28.07.2026', excerpt: '' }]);

    const [row] = store.history();
    assert.equal(row.published_at, '2026-07-28T08:26:12.000Z');
    assert.equal(row.excerpt, 'Stagii de practică pentru studenți.');
    assert.equal(row.date_text, '28.07.2026');
});

test('history is newest first', () => {
    const store = memoryStore();
    const older = { ...feedPost, id: 'post-1', publishedAt: new Date('2026-06-01T00:00:00Z') };
    const newer = { ...feedPost, id: 'post-2', publishedAt: new Date('2026-07-01T00:00:00Z') };
    store.record([older, newer]);

    assert.deepEqual(store.history().map((p) => p.id), ['post-2', 'post-1']);
});

test('history and seen are independent', () => {
    const store = memoryStore();
    store.record([feedPost]);
    assert.equal(store.load().size, 0, 'recording a post does not mark it seen');
});

// --- migration from seen_posts.json ---

test('imports seen_posts.json on first start and renames it', () => {
    const dir = tempDir();
    const jsonPath = path.join(dir, 'seen_posts.json');
    fs.writeFileSync(jsonPath, JSON.stringify(['post-1', 'post-2']));

    const store = createSqliteStore(path.join(dir, 'vigil.db'), { legacyJsonPath: jsonPath, log: silentLog });

    assert.deepEqual([...store.load()].sort(), ['post-1', 'post-2']);
    assert.ok(!fs.existsSync(jsonPath));
    assert.ok(fs.existsSync(`${jsonPath}.migrated`));
    store.close();
});

test('does not import again once the database has data', () => {
    const dir = tempDir();
    const dbPath = path.join(dir, 'vigil.db');
    const jsonPath = path.join(dir, 'seen_posts.json');

    createSqliteStore(dbPath, { log: silentLog }).save(new Set(['post-9']));
    fs.writeFileSync(jsonPath, JSON.stringify(['post-1']));
    const store = createSqliteStore(dbPath, { legacyJsonPath: jsonPath, log: silentLog });

    assert.deepEqual([...store.load()], ['post-9']);
    assert.ok(fs.existsSync(jsonPath), 'file left untouched');
    store.close();
});

test('a broken seen_posts.json is skipped with a warning, not a crash', () => {
    const dir = tempDir();
    const jsonPath = path.join(dir, 'seen_posts.json');
    fs.writeFileSync(jsonPath, '{broken');
    const warnings = [];

    const store = createSqliteStore(path.join(dir, 'vigil.db'), {
        legacyJsonPath: jsonPath,
        log: { ...silentLog, warn: (m) => warnings.push(m) }
    });

    assert.equal(store.load().size, 0);
    assert.match(warnings[0], /Could not migrate/);
    store.close();
});

test('a failed write inside a transaction saves nothing', () => {
    const store = memoryStore();
    assert.throws(() => store.record([feedPost, { ...htmlPost, title: null }]));
    assert.equal(store.history().length, 0, 'the valid post was rolled back too');
});