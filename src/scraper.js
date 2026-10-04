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

    $('h2 a, h3 a').each((_, el) => {
        const link = $(el).attr('href');
        const title = $(el).text().trim();

        if (!link || !link.startsWith('http') || link.includes('/tag/') || link.includes('/category/')) {
            return;
        }

        const container = $(el).closest('article, .post, .entry, div');
        const containerText = container.text();
        const dateMatch = containerText.match(/\b\d{2}\.\d{2}\.\d{4}\b/);
        const date = dateMatch ? dateMatch[0] : 'Recent';

        posts.push({
            id: link.trim(),
            url: link.trim(),
            title,
            category: target.name,
            date
        });
    });

    return posts;
}

async function scrapeAll() {
    const results = [];
    for (const target of TARGETS) {
        try {
            const posts = await fetchCategoryPosts(target);
            results.push(...posts);
        } catch (err) {
            console.error(`[Vigil Scraper Error] ${target.name} (${target.url}): ${err.message}`);
        }
    }
    return results;
}

module.exports = { scrapeAll };