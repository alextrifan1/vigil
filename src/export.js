const { truncateWords } = require('./embeds');

const EXCERPT_LENGTH = 200;
const EMAIL = /[\w.+-]+@[\w-]+(\.[\w-]+)+/g;
const PHONE = /(\+?\d[\d\s./-]{7,}\d)/g;

/** Removes e-mail addresses and phone numbers, which belong to staff or companies, not to the archive. */
function redact(text) {
    return text.replace(EMAIL, '[e-mail]').replace(PHONE, '[telefon]');
}

/** "28.07.2026" → "2026-07-28", so HTML-only posts sort and group like feed posts. */
function isoFromDateText(dateText) {
    const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(dateText || '');
    return match ? `${match[3]}-${match[2]}-${match[1]}` : null;
}

function toArchivePost(row) {
    return {
        id: row.id,
        title: row.title,
        url: row.url,
        boards: row.boards.split(' + '),
        published: row.published_at || isoFromDateText(row.date_text),
        excerpt: row.excerpt ? truncateWords(redact(row.excerpt), EXCERPT_LENGTH) : ''
    };
}

function buildArchive(rows, now = new Date()) {
    const posts = rows
        .map(toArchivePost)
        .sort((a, b) => (b.published || '').localeCompare(a.published || ''));

    return { generatedAt: now.toISOString(), count: posts.length, posts };
}

// Run directly: prints the archive as JSON (node src/export.js), or writes it to a file (node src/export.js out.json).
// Logs go to stderr, so stdout carries only the JSON.
if (require.main === module) {
    const fs = require('fs');
    const { DEFAULTS } = require('./config');
    const { createSqliteStore } = require('./store');

    const toStderr = { log: console.error, warn: console.error, error: console.error };
    const store = createSqliteStore(DEFAULTS.dbFile, { log: toStderr });
    try {
        const json = JSON.stringify(buildArchive(store.history()));
        if (process.argv[2]) {
            fs.writeFileSync(process.argv[2], json);
            console.error(`[Vigil Export] Wrote ${process.argv[2]} (${json.length} bytes).`);
        } else {
            process.stdout.write(json);
        }
    } finally {
        store.close();
    }
}

module.exports = { buildArchive, redact, isoFromDateText };