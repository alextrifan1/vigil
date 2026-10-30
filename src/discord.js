const axios = require('axios');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function sendDiscordNotification(webhookUrl, post) {
    if (!webhookUrl) {
        console.warn('[Vigil] DISCORD_WEBHOOK_URL is unset. Notification bypassed.');
        return;
    }

    // Gold accent for Master, Slate Grey for Licență
    const embedColor = post.category === 'Master' ? 0xF1C40F : 0x34495E;

    const embed = {
        title: post.title.length > 250 ? `${post.title.substring(0, 247)}...` : post.title,
        url: post.url,
        color: embedColor,
        description: `New posting detected on the **${post.category}** practice board.`,
        fields: [
            { name: 'Board', value: post.category, inline: true },
            { name: 'Date', value: post.date, inline: true }
        ],
        footer: {
            text: 'Vigil // Perimeter Watch'
        },
        timestamp: new Date().toISOString()
    };

    try {
        await axios.post(webhookUrl, {
            username: 'Vigil',
            embeds: [embed]
        });
        console.log(`[Vigil Alert Dispatched] [${post.category}] ${post.title}`);
        await sleep(1000); // Guard against rate-limit bursts
        return true;
    } catch (err) {
        console.error(`[Vigil Discord Error] Failed for ${post.url}:`, err.response?.data || err.message);
        return false;
    }
}

module.exports = { sendDiscordNotification };