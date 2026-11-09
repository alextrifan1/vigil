const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { scrapeAll } = require('../src/scraper');
const { TARGETS } = require('../src/config');

const fixture = (name) => fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf-8');
const [LICENTA, MASTER] = TARGETS;

/** Collects warnings and errors instead of printing them. */
function recordingLog() {
    const log = { warnings: [], errors: [], log() {}, warn: (m) => log.warnings.push(m), error: (m) => log.errors.push(m) };
    return log;
}

/** Fake fetch: answers from a URL → text map; an Error value is thrown instead. Records every URL. */
function fakeFetch(responses) {
    const fetch = async (url) => {
        fetch.calls.push(url);
        const response = responses[url];
        if (response === undefined) throw new Error(`unexpected URL: ${url}`);
        if (response instanceof Error) throw response;
        return response;
    };
    fetch.calls = [];
    return fetch;
}

const feeds = {
    [LICENTA.feedUrl]: fixture('licenta-feed.xml'),
    [MASTER.feedUrl]: fixture('master-feed.xml')
};

test('uses the feeds when they work, without touching the HTML pages', async () => {
    const fetch = fakeFetch(feeds);
    const log = recordingLog();
    const posts = await scrapeAll(TARGETS, { fetch, log });

    assert.ok(posts.length > 0);
    assert.deepEqual(fetch.calls, [LICENTA.feedUrl, MASTER.feedUrl]);
    assert.ok(posts.every((p) => p.publishedAt instanceof Date), 'feed posts have exact times');
    assert.deepEqual(log.warnings, []);
});

test('merges posts that appear on both boards', async () => {
    const posts = await scrapeAll(TARGETS, { fetch: fakeFetch(feeds), log: recordingLog() });
    const ids = posts.map((p) => p.id);

    assert.equal(new Set(ids).size, ids.length, 'duplicate IDs after merging');
    assert.ok(posts.some((p) => p.category === 'Licență + Master'));
});

test('falls back to the HTML page when the feed fails', async () => {
    const fetch = fakeFetch({
        [LICENTA.feedUrl]: new Error('getaddrinfo EAI_AGAIN'),
        [LICENTA.url]: fixture('licenta-snapshot.html')
    });
    const log = recordingLog();
    const posts = await scrapeAll([LICENTA], { fetch, log });

    assert.ok(posts.length > 0);
    assert.deepEqual(fetch.calls, [LICENTA.feedUrl, LICENTA.url]);
    assert.match(log.warnings[0], /Feed for Licență failed.*Falling back to HTML/);
});

test('falls back to the HTML page when the feed is empty', async () => {
    const fetch = fakeFetch({
        [LICENTA.feedUrl]: '<html><body>Not found</body></html>',
        [LICENTA.url]: fixture('licenta-snapshot.html')
    });
    const log = recordingLog();
    const posts = await scrapeAll([LICENTA], { fetch, log });

    assert.ok(posts.length > 0);
    assert.match(log.warnings[0], /returned 0 items/);
});

test('a board where feed and page both fail is skipped, the other still counts', async () => {
    const fetch = fakeFetch({
        [LICENTA.feedUrl]: new Error('down'),
        [LICENTA.url]: new Error('down too'),
        [MASTER.feedUrl]: fixture('master-feed.xml')
    });
    const log = recordingLog();
    const posts = await scrapeAll(TARGETS, { fetch, log });

    assert.ok(posts.length > 0);
    assert.ok(posts.every((p) => p.category === 'Master'));
    assert.match(log.errors[0], /Licență/);
});

test('all boards configured with a feed URL', () => {
    for (const target of TARGETS) {
        assert.match(target.feedUrl, /^https:\/\/.+\/feed\/$/, target.name);
    }
});