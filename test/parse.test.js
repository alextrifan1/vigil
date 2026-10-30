const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { parsePosts, mergeBoards } = require('../src/parse');

const fixture = (name) => fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf-8');
const board = fixture('board.html');
const snapshot = fixture('licenta-snapshot.html');

// --- Real snapshot: properties that must hold for any real board page ---

test('snapshot: finds posts', () => {
    const posts = parsePosts(snapshot, 'Licență');
    assert.ok(posts.length > 0, 'no posts parsed from the real page');
});

test('snapshot: every post has a valid URL that is not a category or tag listing', () => {
    for (const post of parsePosts(snapshot, 'Licență')) {
        assert.match(post.url, /^https?:\/\//, `not an http(s) URL: ${post.url}`);
        assert.ok(!post.url.includes('/category/') && !post.url.includes('/tag/'), `listing URL: ${post.url}`);
    }
});

test('snapshot: every post has a title and a dd.mm.yyyy date', () => {
    for (const post of parsePosts(snapshot, 'Licență')) {
        assert.ok(post.title.length > 0, `empty title for ${post.url}`);
        assert.match(post.date, /^\d{2}\.\d{2}\.\d{4}$/, `bad date for ${post.url}`);
    }
});

test('snapshot: post IDs are unique', () => {
    const ids = parsePosts(snapshot, 'Licență').map((p) => p.id);
    assert.equal(new Set(ids).size, ids.length);
});

// --- Hand-made fixture: exact results ---

test('parses exactly the posts in the post list', () => {
    assert.deepEqual(parsePosts(board, 'Licență').map((p) => p.url), [
        'https://www.cs.ubbcluj.ro/practica-backend-java-2026/',
        'https://www.cs.ubbcluj.ro/internship-data-engineering/',
        'https://www.cs.ubbcluj.ro/anunt-fara-data/'
    ]);
});

test('ignores links in excerpts, the sidebar and the header', () => {
    const urls = parsePosts(board, 'Licență').map((p) => p.url);
    assert.ok(!urls.includes('https://acme.example.com/apply'));
    assert.ok(!urls.includes('https://www.cs.ubbcluj.ro/category/anunturi/'));
    assert.ok(!urls.includes('https://www.cs.ubbcluj.ro/orar/'));
    assert.ok(!urls.includes('https://www.cs.ubbcluj.ro/'));
});

test('extracts every field of a post', () => {
    const [first] = parsePosts(board, 'Master');
    assert.deepEqual(first, {
        id: 'https://www.cs.ubbcluj.ro/practica-backend-java-2026/',
        postId: 'post-69438',
        url: 'https://www.cs.ubbcluj.ro/practica-backend-java-2026/',
        title: 'Practică Backend Java – Acme Software',
        category: 'Master',
        date: '28.07.2026'
    });
});

test('trims whitespace around titles', () => {
    assert.equal(parsePosts(board, 'Licență')[1].title, 'Internship Data Engineering');
});

test('falls back to "Recent" when a post has no date', () => {
    assert.equal(parsePosts(board, 'Licență')[2].date, 'Recent');
});

test('returns an empty list when the layout is different', () => {
    const otherLayout = '<html><body><h2><a href="https://x.ro/">x</a></h2></body></html>';
    assert.deepEqual(parsePosts(otherLayout, 'Licență'), []);
});

// --- mergeBoards ---

test('mergeBoards keeps cross-posted items once with a combined label', () => {
    const licenta = parsePosts(board, 'Licență');
    const master = parsePosts(board, 'Master').slice(0, 1); // only the first post is on both boards

    const merged = mergeBoards([licenta, master]);

    assert.equal(merged.length, 3);
    assert.equal(merged[0].category, 'Licență + Master');
    assert.equal(merged[1].category, 'Licență');
});

test('mergeBoards does not change the input posts', () => {
    const a = [{ id: '1', category: 'Licență' }];
    const b = [{ id: '1', category: 'Master' }];
    mergeBoards([a, b]);
    assert.equal(a[0].category, 'Licență');
});