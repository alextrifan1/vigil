const { parseFeed, mergeBoards} = require('./parse');

/**
 * One-time backfill: walks every page of each board's RSS feed and records all
 * posts into the history. It never touches `seen`, so it cannot trigger alerts.
 *
 * Run inside the container:  node src/backfill.js
 */

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** WordPress redirects ?paged=1 to the plain feed URL, so page 1 uses that directly. */
function pageUrl(feedUrl, page) {
    return page === 1 ? feedUrl : `${feedUrl}?paged=${page}`;
}

async function fetchAllPages(target, { fetch, maxPages, delayMs, log }) {
    const byId = new Map();

    for (let page = 1; page <= maxPages; page++) {
        if (page > 1) await sleep(delayMs);

        let posts;
        try {
            posts = parseFeed(await fetch(pageUrl(target.feedUrl, page)), target.name);
        } catch (err) {
            if (err.response?.status === 404) break; // past the last page: the normal end
            log.warn(`[Vigil Backfill] ${target.name} page ${page} failed (${err.message}). Stopping this board.`);
            break;
        }
        if (posts.length === 0) break;

        // A post can show up twice if something new is published while we walk the pages.
        for (const post of posts) byId.set(post.id, post);
        log.log(`[Vigil Backfill] ${target.name} page ${page}: ${posts.length} posts`);
    }

    return [...byId.values()];
}

async function backfill({ targets, fetch, history, maxPages = 50, delayMs = 1000, log = console }) {
    const postLists = [];
    for (const target of targets) {
        postLists.push(await fetchAllPages(target, { fetch, maxPages, delayMs, log }));
    }

    const posts = mergeBoards(postLists);
    history.record(posts);
    log.log(`[Vigil Backfill] Done. Recorded ${posts.length} posts in the history.`);
    return posts.length;
}


// Run directly (node src/backfill.js): uses the real feeds and the real database.
if (require.main === module) {
    const { TARGETS, DEFAULTS } = require('./config');
    const { createSqliteStore } = require('./store');
    const { fetchText } = require('./scraper');

    const store = createSqliteStore(DEFAULTS.dbFile);
    backfill({ targets: TARGETS, fetch: fetchText, history: store })
        .catch((err) => {
            console.error('[Vigil Backfill] Failed:', err);
            process.exitCode = 1;
        })
        .finally(() => store.close());
}

module.exports = { backfill, pageUrl };
