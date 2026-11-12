const { test } = require('node:test');
const assert = require('node:assert/strict');

const { backfill, pageUrl } = require('../src/backfill');

const silentLog = { log() {}, warn() {}, error() {} };
const LICENTA = { name: 'Licență', feedUrl: 'https://x.ro/licenta/feed/' };
const MASTER = { name: 'Master', feedUrl: 'https://x.ro/master/feed/' };

/** A minimal RSS feed with one <item> per WordPress post number. */
function feed(...ids) {
    const items = ids.map((id) => `
        <item>
            <title>Post ${id}</title>
            <link>https://x.ro/post-${id}/</link>
            <guid>https://x.ro/?p=${id}</guid>
            <pubDate>Mon, 15 Jun 2026 16:31:22 +0000</pubDate>
            <description>Excerpt ${id}</description>
        </item>`).join('');
    return `<?xml version="1.0"?><rss version="2.0"><channel><title>t</title>${items}</channel></rss>`;
}

const notFound = () => Object.assign(new Error('Request failed with status code 404'), { response: { status: 404 } });

/** Fake fetch: URL → text, or an Error to throw. Unknown URLs are a 404, like WordPress past the last page. */
function fakeFetch(pages) {
    const fetch = async (url) => {
        fetch.calls.push(url);
        const response = pages[url];
        if (response === undefined) throw notFound();
        if (response instanceof Error) throw response;
        return response;
    };
    fetch.calls = [];
    return fetch;
}

/** Fake history: keeps what was recorded. */
function fakeHistory() {
    const history = { posts: [], record: (posts) => history.posts.push(...posts) };
    return history;
}

const run = (targets, pages, options = {}) => {
    const fetch = fakeFetch(pages);
    const history = fakeHistory();
    return backfill({ targets, fetch, history, delayMs: 0, log: silentLog, ...options })
        .then((count) => ({ count, fetch, history }));
};

test('page 1 is the plain feed URL, later pages use ?paged=N', () => {
    assert.equal(pageUrl('https://x.ro/feed/', 1), 'https://x.ro/feed/');
    assert.equal(pageUrl('https://x.ro/feed/', 3), 'https://x.ro/feed/?paged=3');
});

test('walks the pages until the 404 and records every post', async () => {
    const { count, fetch, history } = await run([LICENTA], {
        'https://x.ro/licenta/feed/': feed(30, 29),
        'https://x.ro/licenta/feed/?paged=2': feed(28, 27),
        'https://x.ro/licenta/feed/?paged=3': feed(26)
    });

    assert.equal(count, 5);
    assert.deepEqual(history.posts.map((p) => p.id), ['post-30', 'post-29', 'post-28', 'post-27', 'post-26']);
    assert.deepEqual(fetch.calls, [
        'https://x.ro/licenta/feed/',
        'https://x.ro/licenta/feed/?paged=2',
        'https://x.ro/licenta/feed/?paged=3',
        'https://x.ro/licenta/feed/?paged=4'
    ]);
});

test('stops at an empty page', async () => {
    const { count, fetch } = await run([LICENTA], {
        'https://x.ro/licenta/feed/': feed(30),
        'https://x.ro/licenta/feed/?paged=2': feed()
    });
    assert.equal(count, 1);
    assert.equal(fetch.calls.length, 2);
});

test('never fetches more than maxPages', async () => {
    const pages = {};
    for (let p = 1; p <= 10; p++) pages[pageUrl(LICENTA.feedUrl, p)] = feed(100 - p);

    const { count, fetch } = await run([LICENTA], pages, { maxPages: 3 });
    assert.equal(count, 3);
    assert.equal(fetch.calls.length, 3);
});

test('a failing page stops that board but keeps what it already got, and the other board continues', async () => {
    const warnings = [];
    const { history } = await run([LICENTA, MASTER], {
        'https://x.ro/licenta/feed/': feed(30),
        'https://x.ro/licenta/feed/?paged=2': new Error('getaddrinfo EAI_AGAIN'),
        'https://x.ro/master/feed/': feed(40)
    }, { log: { ...silentLog, warn: (m) => warnings.push(m) } });

    assert.deepEqual(history.posts.map((p) => p.id).sort(), ['post-30', 'post-40']);
    assert.match(warnings[0], /Licență page 2 failed/);
});

test('a post on both boards is recorded once with the combined label', async () => {
    const { history } = await run([LICENTA, MASTER], {
        'https://x.ro/licenta/feed/': feed(30, 29),
        'https://x.ro/master/feed/': feed(30)
    });
    const shared = history.posts.find((p) => p.id === 'post-30');
    assert.equal(shared.category, 'Licență + Master');
    assert.equal(history.posts.length, 2);
});

test('a post repeated across pages of the same board is not labelled twice', async () => {
    const { history } = await run([LICENTA], {
        'https://x.ro/licenta/feed/': feed(30, 29),
        'https://x.ro/licenta/feed/?paged=2': feed(29, 28) // 29 shifted down while we were walking
    });
    assert.equal(history.posts.length, 3);
    assert.ok(history.posts.every((p) => p.category === 'Licență'));
});

test('works end to end with the real store, and marks nothing as seen', async () => {
    const { createSqliteStore } = require('../src/store');
    const store = createSqliteStore(':memory:', { log: silentLog });

    await backfill({
        targets: [LICENTA],
        fetch: fakeFetch({ 'https://x.ro/licenta/feed/': feed(30, 29) }),
        history: store,
        delayMs: 0,
        log: silentLog
    });

    assert.equal(store.history().length, 2);
    assert.equal(store.load().size, 0, 'backfill must never mark posts as seen');
    store.close();
});

test('the CLI dependencies exist (wiring the fakes do not cover)', () => {
    const { fetchText } = require('../src/scraper');
    const { DEFAULTS, TARGETS } = require('../src/config');

    assert.equal(typeof fetchText, 'function');
    assert.ok(DEFAULTS.dbFile.endsWith('vigil.db'));
    assert.ok(TARGETS.every((t) => t.feedUrl));
});