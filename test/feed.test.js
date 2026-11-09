const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { parseFeed, parsePosts, mergeBoards } = require('../src/parse');

const fixture = (name) => fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf-8');
const licentaFeed = fixture('licenta-feed.xml');
const masterFeed = fixture('master-feed.xml');

// --- Real feeds: properties that must hold ---

test('real feeds: find posts', () => {
    assert.ok(parseFeed(licentaFeed, 'Licență').length > 0);
    assert.ok(parseFeed(masterFeed, 'Master').length > 0);
});

test('real feeds: every post has a WordPress id, URL, title, publish time and excerpt', () => {
    for (const post of parseFeed(licentaFeed, 'Licență')) {
        assert.match(post.id, /^post-\d+$/, `bad id for ${post.url}`);
        assert.match(post.url, /^https?:\/\//);
        assert.ok(post.title.length > 0, `empty title for ${post.url}`);
        assert.ok(post.publishedAt instanceof Date, `no publish time for ${post.url}`);
        assert.ok(post.excerpt.length > 0, `empty excerpt for ${post.url}`);
    }
});

test('real feeds: no HTML entities left in titles or excerpts', () => {
    for (const post of parseFeed(licentaFeed, 'Licență')) {
        assert.doesNotMatch(post.title, /&#\d+;|&amp;/, post.title);
        assert.doesNotMatch(post.excerpt, /&#\d+;|&amp;/, post.excerpt);
    }
});

test('real feeds: a post on both boards is merged into one', () => {
    const merged = mergeBoards([parseFeed(licentaFeed, 'Licență'), parseFeed(masterFeed, 'Master')]);
    assert.ok(merged.some((p) => p.category === 'Licență + Master'));
});

test('feed and HTML page produce the same IDs', () => {
    const feedIds = new Set(parseFeed(licentaFeed, 'Licență').map((p) => p.id));
    const htmlIds = parsePosts(fixture('licenta-snapshot.html'), 'Licență').map((p) => p.id);
    assert.ok(htmlIds.some((id) => feedIds.has(id)), 'no ID in common between feed and HTML');
});

// --- Hand-made feed: exact results ---

const small = `<?xml version="1.0"?><rss version="2.0"><channel>
  <title>Board</title><link>https://www.cs.ubbcluj.ro</link>
  <item>
    <title>Bootcamp STS 2026 &#8211; IT&#038;C</title>
    <link>https://www.cs.ubbcluj.ro/bootcamp-sts-2026/</link>
    <pubDate>Mon, 15 Jun 2026 16:31:22 +0000</pubDate>
    <guid isPermaLink="false">https://www.cs.ubbcluj.ro/?p=68742</guid>
    <description><![CDATA[Program pentru   IT&#38;C.
      Participanții [&#8230;]]]></description>
  </item>
  <item>
    <title>Fără guid</title>
    <link>https://www.cs.ubbcluj.ro/fara-guid/</link>
    <pubDate>not a date</pubDate>
    <description></description>
  </item>
</channel></rss>`;

test('extracts every field of a feed item', () => {
    const [first] = parseFeed(small, 'Master');
    assert.deepEqual(first, {
        id: 'post-68742',
        url: 'https://www.cs.ubbcluj.ro/bootcamp-sts-2026/',
        title: 'Bootcamp STS 2026 – IT&C',
        category: 'Master',
        publishedAt: new Date('2026-06-15T16:31:22Z'),
        date: null,
        excerpt: 'Program pentru IT&C. Participanții […]'
    });
});

test('ignores the channel <link>, only items count', () => {
    assert.equal(parseFeed(small, 'Master').length, 2);
});

test('falls back to the URL as id and null as time when guid or date are missing', () => {
    const second = parseFeed(small, 'Master')[1];
    assert.equal(second.id, 'https://www.cs.ubbcluj.ro/fara-guid/');
    assert.equal(second.publishedAt, null);
    assert.equal(second.excerpt, '');
});

test('returns an empty list for something that is not a feed', () => {
    assert.deepEqual(parseFeed('<html><body>404</body></html>', 'Master'), []);
});