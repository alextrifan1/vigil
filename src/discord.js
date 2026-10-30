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

function formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    return `${days}d ${hours}h`;
}


async function sendHeartbeat(webhookUrl, stats) {
    const warnings = [];

    if (stats.sweeps === 0) warnings.push('No sweeps ran since the last report.');
    if (stats.failedSweeps > 0) warnings.push(`${stats.failedSweeps} sweep(s) failed.`);
    if (stats.lastPostCount === 0) warnings.push('Last sweep found 0 posts. Scraper may be broken.');

    const lastSweep = stats.lastSweepAt
        ? `<t:${Math.floor(stats.lastSweepAt.getTime() / 1000)}:R>`
        : 'never';

    const embed = {
        title: warnings.length ? 'Vigil weekly report: needs attention' : 'Vigil weekly report: all good',
        color: warnings.length ? 0xE67E22 : 0x2ECC71,
        description: warnings.length ? warnings.map((w) => `• ${w}`).join('\n') : 'Still watching both boards.',
        fields: [
            { name: 'Sweeps', value: String(stats.sweeps), inline: true },
            { name: 'Alerts sent', value: String(stats.alerts), inline: true },
            { name: 'Tracked posts', value: String(stats.trackedCount), inline: true },
            { name: 'Last sweep', value: lastSweep, inline: true },
            { name: 'Uptime', value: formatUptime(stats.uptimeSeconds), inline: true }
        ],
        footer: { text: 'Vigil // Perimeter Watch' },
        timestamp: new Date().toISOString()
    };

    try {
        await axios.post(webhookUrl, { username: 'Vigil', embeds: [embed] });
        console.log('[Vigil Heartbeat] Weekly report dispatched.');
        return true;
    } catch (err) {
        console.error('[Vigil Heartbeat Error]', err.response?.data || err.message);
        return false;
    }
}

module.exports = { sendDiscordNotification, sendHeartbeat  };