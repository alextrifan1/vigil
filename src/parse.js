const cheerio = require('cheerio');


function decodeHtml(text) {
    return cheerio.load(text).text();
}

function idFromGuid(guid) {
    const match = guid.match(/[?&]p=(\d+)/);
    return match ? `post-${match[1]}` : null;
}

/**
 * Extracts posts from a board's RSS feed. Pure: XML in, posts out, no network.
 */

function parseFeed(xml, boardName) {
    const $ = cheerio.load(xml, {xml: true});
    const posts = [];

    $('channel > item').each((_, el) => {
        const $item = $(el);
        const url = $item.children('link').text().trim();
        if (!url) return;

        const published = new Date($item.children('pubDate').text().trim());

        posts.push({
            id: idFromGuid($item.children('guid').text()) || url,
            url,
            title: $item.children('title').text().trim(),
            category: boardName,
            publishedAt: Number.isNaN(published.getTime()) ? null : published,
            date: null,
            excerpt: decodeHtml($item.children('description').text()).replace(/\s+/g, ' ').trim()
        });
    });

    return posts;
}


/**
 * Extracts posts from one board page
 *  #content > .post-wrap > .post > h2.title a   (title + link)
 *  .postmeta-primary .meta_date (publication date)
 */
function parsePosts(html, boardName) {
    const $ = cheerio.load(html);
    const posts = [];

    $('#content .post-wrap > .post').each((_, el) => {
        const $post = $(el);
        const $link = $post.find('h2.title a').first();
        const url = $link.attr('href')?.trim();
        if (!url) return;

        posts.push({
            id: $post.attr('id') || url, // "post-69438", same as the feed
            url,
            title: $link.text().trim(),
            category: boardName,
            publishedAt: null,
            date: $post.find('.meta_date').first().text().trim() || 'Recent',
            excerpt: $post.find('.entry').first().text().replace(/\s+/g, ' ').trim()
        });
    });

    return posts;
}

/**
 * Merges posts from several boards. A post that appears on more than one
 * board is kept once, with the board names joined ("Licență + Master").
 */
function mergeBoards(postLists) {
    const byId = new Map();
    for (const posts of postLists) {
        for (const post of posts) {
            const existing = byId.get(post.id);
            if (existing) {
                existing.category = `${existing.category} + ${post.category}`;
            } else {
                byId.set(post.id, { ...post});
            }
        }
    }
    return [...byId.values()];
}

module.exports = { parseFeed, parsePosts, mergeBoards};