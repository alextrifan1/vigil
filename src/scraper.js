const axios = require('axios');
const { parsePosts, mergeBoards, parseFeed} = require('./parse');

const HTTP_CLIENT = axios.create({
    timeout: 15000,
    responseType: 'text',
    headers: {
        'User-Agent': 'Vigil/1.0 (+https://github.com/alextrifan1/vigil)',
        'Accept': 'application/rss+xml, application/xml;q=0.9, text/html;q=0.8, */*;q=0.5',
        'Accept-Language': 'ro-RO,ro;q=0.9,en-US;q=0.8,en;q=0.7'
    }
});

async function fetchText(url) {
    const { data } = await HTTP_CLIENT.get(url);
    return data;
}

/**
 * Gets one board's posts: RSS feed first, HTML page if the feed fails or is empty.
 * Throws only if both fail.
 */
async function fetchBoard(target, {fetch, log}) {
    try {
        const posts = parseFeed(await fetch(target.feedUrl), target.name);
        if (posts.length > 0) return posts;
        log.warn(`[Vigil Scraper] Feed for ${target.name} returned 0 items. Falling back to HTML.`);
    } catch (err) {
        log.warn(`[Vigil Scraper] Feed for ${target.name} failed (${err.message}). Falling back to HTML.`);
    }
    return parsePosts(await fetch(target.url), target.name);
}

async function scrapeAll(targets, { fetch = fetchText, log = console } = {}) {
    const postLists = [];

    for (const target of targets) {
        try {
            const posts = await fetchBoard(target, { fetch, log });
            if (posts.length === 0) {
                log.warn(`[Vigil Scraper] 0 posts parsed on ${target.name}. Page layout may have changed.`);
            }
            postLists.push(posts);
        } catch (err) {
            log.error(`[Vigil Scraper Error] ${target.name} (${target.url}): ${err.message}`);
        }
    }

    return mergeBoards(postLists);
}

module.exports = { scrapeAll, fetchText };