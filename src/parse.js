const cheerio = require('cheerio');

/**
 * Extracts posts from one board page
 *  #content > .post-wrap > .post > h2.title a   (title + link)
 *  .postmeta-primary .meta_date (publication date)
 */
function paresePosts(html, boardName) {
    const $ = cheerio.load(html);
    const posts = [];

    $('#content .post-wrap > .post').each((_, el) => {
        const $post = $(el);
        const $link = $post.find('h2.title a').first();
        const url = $link.attr('href')?.trim();
        if (!url) return;

        posts.push({
            id: url,
            postId: $post.attr('id') || null,
            url,
            title: $link.text().trim(),
            category: boardName,
            date: $post.find('.meta_date').first().text().trim() || 'Recent'
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

module.exports = { paresePosts, mergeBoards};