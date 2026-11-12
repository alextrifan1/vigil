const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

/**
 * SQLite storage for Vigil, in one file (data/vigil.db):
 *   seen  - IDs already handled (alerted on, or indexed at cold start). Replaces seen_posts.json.
 *   posts - every post ever seen, with its details. The history behind the archive page.
 */
const SCHEMA = `
    CREATE TABLE IF NOT EXISTS seen (
                                        id      TEXT PRIMARY KEY,
                                        seen_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS posts (
                                         id            TEXT PRIMARY KEY,
                                         url           TEXT NOT NULL,
                                         title         TEXT NOT NULL,
                                         boards        TEXT NOT NULL,
                                         excerpt       TEXT,
                                         published_at  TEXT,
                                         date_text     TEXT,
                                         first_seen_at TEXT NOT NULL,
                                         last_seen_at  TEXT NOT NULL
    );
`;

function createSqliteStore(dbPath, { legacyJsonPath = null, now = () => new Date(), log = console } = {}) {
    if (dbPath !== ':memory:') {
        fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    }
    const db = new DatabaseSync(dbPath);
    db.exec('PRAGMA journal_mode = WAL');
    db.exec(SCHEMA);

    const selectSeen = db.prepare('SELECT id FROM seen');
    const insertSeen = db.prepare('INSERT OR IGNORE INTO seen (id, seen_at) VALUES (?, ?)');
    const upsertPost = db.prepare(`
        INSERT INTO posts (id, url, title, boards, excerpt, published_at, date_text, first_seen_at, last_seen_at)
        VALUES (:id, :url, :title, :boards, :excerpt, :publishedAt, :dateText, :now, :now)
            ON CONFLICT(id) DO UPDATE SET
            url          = excluded.url,
                                   title        = excluded.title,
                                   boards       = excluded.boards,
                                   excerpt      = COALESCE(excluded.excerpt, posts.excerpt),
                                   published_at = COALESCE(excluded.published_at, posts.published_at),
                                   date_text    = COALESCE(excluded.date_text, posts.date_text),
                                   last_seen_at = excluded.last_seen_at
    `);
    const selectHistory = db.prepare(`
        SELECT id, url, title, boards, excerpt, published_at, date_text, first_seen_at, last_seen_at
        FROM posts
        ORDER BY COALESCE(published_at, first_seen_at) DESC
    `);

    /** Runs fn inside one transaction: all of its writes are saved, or none are. */
    function transaction(fn) {
        db.exec('BEGIN');
        try {
            fn();
            db.exec('COMMIT');
        } catch (err) {
            db.exec('ROLLBACK');
            throw err;
        }
    }

    // --- state: the same load()/save() shape sweep already uses ---

    function load() {
        return new Set(selectSeen.all().map((row) => row.id));
    }

    function save(seenSet) {
        const timestamp = now().toISOString();
        transaction(() => {
            for (const id of seenSet) insertSeen.run(id, timestamp);
        });
    }

    // --- history ---

    function record(posts) {
        const timestamp = now().toISOString();
        transaction(() => {
            for (const post of posts) {
                upsertPost.run({
                    id: post.id,
                    url: post.url,
                    title: post.title,
                    boards: post.category,
                    excerpt: post.excerpt || null,
                    publishedAt: post.publishedAt ? post.publishedAt.toISOString() : null,
                    dateText: post.date || null,
                    now: timestamp
                });
            }
        });
    }

    function history() {
        return selectHistory.all().map((row) => ({ ...row }));
    }

    // --- one-time migration from seen_posts.json ---

    function migrateLegacyJson() {
        if (!legacyJsonPath || !fs.existsSync(legacyJsonPath) || load().size > 0) return;
        try {
            const ids = JSON.parse(fs.readFileSync(legacyJsonPath, 'utf-8'));
            save(new Set(ids));
            fs.renameSync(legacyJsonPath, `${legacyJsonPath}.migrated`);
            log.log(`[Vigil Store] Migrated ${ids.length} seen IDs from ${path.basename(legacyJsonPath)}.`);
        } catch (err) {
            log.warn(`[Vigil Store] Could not migrate ${legacyJsonPath}: ${err.message}`);
        }
    }

    migrateLegacyJson();

    return { load, save, record, history, close: () => db.close() };
}

module.exports = { createSqliteStore };