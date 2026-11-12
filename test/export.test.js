const { test } = require('node:test');
const assert = require('node:assert/strict');

const { buildArchive, redact, isoFromDateText } = require('../src/export');

const NOW = new Date('2026-11-12T20:00:00Z');

/** A history row as store.history() returns it. */
const row = (overrides = {}) => ({
    id: 'post-69438',
    url: 'https://www.cs.ubbcluj.ro/practica-backend-java-2026/',
    title: 'Practică Backend Java',
    boards: 'Licență + Master',
    excerpt: 'Stagii de practică pentru studenți.',
    published_at: '2026-07-28T08:26:12.000Z',
    date_text: null,
    first_seen_at: '2026-11-12T10:00:00.000Z',
    last_seen_at: '2026-11-12T10:00:00.000Z',
    ...overrides
});

test('builds the archive with only the public fields', () => {
    assert.deepEqual(buildArchive([row()], NOW), {
        generatedAt: '2026-11-12T20:00:00.000Z',
        count: 1,
        posts: [{
            id: 'post-69438',
            title: 'Practică Backend Java',
            url: 'https://www.cs.ubbcluj.ro/practica-backend-java-2026/',
            boards: ['Licență', 'Master'],
            published: '2026-07-28T08:26:12.000Z',
            excerpt: 'Stagii de practică pentru studenți.'
        }]
    });
});

test('internal timestamps are not exported', () => {
    const [post] = buildArchive([row()], NOW).posts;
    assert.ok(!('first_seen_at' in post) && !('last_seen_at' in post));
});

test('a single board becomes a one-element list', () => {
    assert.deepEqual(buildArchive([row({ boards: 'Master' })]).posts[0].boards, ['Master']);
});

test('HTML-only posts get an ISO date from their date text', () => {
    const [post] = buildArchive([row({ published_at: null, date_text: '15.07.2026' })]).posts;
    assert.equal(post.published, '2026-07-15');
});

test('posts without any date get null and sort last', () => {
    const posts = buildArchive([
        row({ id: 'post-1', published_at: null, date_text: 'Recent' }),
        row({ id: 'post-2', published_at: '2025-01-01T00:00:00.000Z' })
    ]).posts;
    assert.deepEqual(posts.map((p) => [p.id, p.published]), [['post-2', '2025-01-01T00:00:00.000Z'], ['post-1', null]]);
});

test('posts are sorted newest first, mixing exact times and plain dates', () => {
    const posts = buildArchive([
        row({ id: 'post-old', published_at: '2025-03-01T10:00:00.000Z' }),
        row({ id: 'post-html', published_at: null, date_text: '01.06.2026' }),
        row({ id: 'post-new', published_at: '2026-07-28T08:26:12.000Z' })
    ]).posts;
    assert.deepEqual(posts.map((p) => p.id), ['post-new', 'post-html', 'post-old']);
});

test('excerpts are shortened to a teaser', () => {
    const [post] = buildArchive([row({ excerpt: 'cuvânt '.repeat(100).trim() })]).posts;
    assert.ok(post.excerpt.length <= 200);
    assert.ok(post.excerpt.endsWith('…'));
});

test('a missing excerpt becomes an empty string', () => {
    assert.equal(buildArchive([row({ excerpt: null })]).posts[0].excerpt, '');
});

test('e-mail addresses and phone numbers are removed from excerpts', () => {
    assert.equal(redact('Trimiteți CV-ul la hr.cluj@acme-soft.ro până vineri.'), 'Trimiteți CV-ul la [e-mail] până vineri.');
    assert.equal(redact('Sunați la 0745 123 456 sau +40 264 405 300.'), 'Sunați la [telefon] sau [telefon].');
    assert.equal(redact('Stagiu de 3 luni, 20 de locuri, anul 2026.'), 'Stagiu de 3 luni, 20 de locuri, anul 2026.');
});

test('isoFromDateText only accepts dd.mm.yyyy', () => {
    assert.equal(isoFromDateText('28.07.2026'), '2026-07-28');
    assert.equal(isoFromDateText('Recent'), null);
    assert.equal(isoFromDateText(null), null);
});

test('an empty history gives an empty archive', () => {
    assert.deepEqual(buildArchive([], NOW), { generatedAt: '2026-11-12T20:00:00.000Z', count: 0, posts: [] });
});