const axios = require('axios');
const { parsePosts, mergeBoards } = require('./parse');

const HTTP_CLIENT = axios.create({
    timeout: 15000,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ro-RO,ro;q=0.9,en-US;q=0.8,en;q=0.7'
    }
});

async function fetchHtml(url) {
    const { data } = await HTTP_CLIENT.get(url);
    return data;
}

async function scrapeAll(targets) {
    const postLists = [];

    for (const target of targets) {
        try {
            const posts = parsePosts(await fetchHtml(target.url), target.name);
            if (posts.length === 0) {
                console.warn(`[Vigil Scraper] 0 posts parsed on ${target.name}. Page layout may have changed.`);
            }
            postLists.push(posts);
        } catch (err) {
            console.error(`[Vigil Scraper Error] ${target.name} (${target.url}): ${err.message}`);
        }
    }

    return mergeBoards(postLists);
}

module.exports = { scrapeAll };