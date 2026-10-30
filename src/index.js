const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
require('dotenv').config();

const { scrapeAll } = require('./scraper');
const { sendDiscordNotification } = require('./discord');

const DATA_DIR = path.join(__dirname, '../data');
const STATE_FILE = path.join(DATA_DIR, 'seen_posts.json');
const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
const CRON_SCHEDULE = process.env.CRON_SCHEDULE || '*/30 8-18 * * 1-5';

function loadSeenPosts() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(STATE_FILE)) {
        try {
            const data = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
            return new Set(data);
        } catch {
            console.warn('[Vigil State] Invalid JSON in state file. Initializing fresh set.');
            return new Set();
        }
    }
    return new Set();
}

function saveSeenPosts(seenSet) {
    fs.writeFileSync(STATE_FILE, JSON.stringify([...seenSet], null, 2), 'utf-8');
}

async function sweep() {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] Vigil sweep initiated...`);

    const seenPosts = loadSeenPosts();
    const isColdStart = seenPosts.size === 0;
    const currentPosts = await scrapeAll();

    let newPostsCount = 0;

    for (const post of currentPosts) {

        if (seenPosts.has(post.id)) continue;

        if (isColdStart) {
            seenPosts.add(post.id);
            newPostsCount++;
            continue;
        }

        const sent = sendDiscordNotification(WEBHOOK_URL, post);
        if (sent) {
            seenPosts.add(post.id);
            newPostsCount++;
        }
    }

    saveSeenPosts(seenPosts);

    if (isColdStart) {
        console.log(`[Vigil Cold Start] Baseline established. Indexed ${seenPosts.size} existing announcements.`);
    } else {
        console.log(`[Vigil Sweep Complete] ${newPostsCount} new item(s) found. Total tracked: ${seenPosts.size}.`);
    }
}

// Initial sweep on start
sweep().catch(console.error);

// Recurring sweep
cron.schedule(CRON_SCHEDULE, () => {
    sweep().catch(console.error);
}, { timezone: 'Europe/Bucharest' });

console.log(`[Vigil Online] Polling armed on schedule: "${CRON_SCHEDULE}"`);