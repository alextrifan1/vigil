const axios = require('axios');
const cheerio = require('cheerio');

const TARGETS = [
    {
        name: 'Licență',
        url: 'https://www.cs.ubbcluj.ro/anunturi/anunturi-studenti/anunturi-practica/'
    },
    {
        name: 'Master',
        url: 'https://www.cs.ubbcluj.ro/anunturi/anunturi-studenti/anunturi-practica-nivel-master/'
    }
];

const HTTP_CLIENT = axios.create({
    timeout: 15000,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ro-RO,ro;q=0.9,en-US;q=0.8,en;q=0.7'
    }
});

async function fetchCategoryPosts(target) {
    const {data: html} = await HTTP_CLIENT.get(target.url);
    const $ = cheerio.load(html);
    const posts = [];

    $('#content .post-wrap > .post').each((_, el) => {
        const $post = $(el);
        const $link = $post.find('h2.title a').first();
        const url = $link.attr('href')?.trim();
        if (!url) return;

        posts.push({
            id: url, // keep URL as ID so the existing seen_posts.json stays valid
            postId: $post.attr('id') || null, // e.g. "post-69438"
            url,
            title: $link.text().trim(),
            category: target.name,
            date: $post.find('.meta_date').first().text().trim() || 'Recent'
        });
    });

    if (posts.length === 0) {
        console.warn(`[Vigil Scraper] 0 posts parsed on ${target.name}. Page layout may have changed.`);
    }
    return posts;
}

async function scrapeAll() {
    const byId = new Map();
    for (const target of TARGETS) {
        try {
            for (const post of await fetchCategoryPosts(target)) {
                const existing = byId.get(post.id);
                if (existing) {
                    existing.category = `${existing.category} + ${post.category}`;
                } else {
                    byId.set(post.id, post);
                }
            }
        } catch (err) {
            console.error(`[Vigil Scraper Error] ${target.name} (${target.url}): ${err.message}`);
        }
    }
    return [...byId.values()];
}

module.exports = { scrapeAll };