const axios = require('axios');
const { buildPostEmbed, buildHeartbeatEmbed } = require('./embeds');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function sendDiscordNotification(webhookUrl, post) {
    try {
        await axios.post(webhookUrl, { username: 'Vigil', embeds: [buildPostEmbed(post)] });
        console.log(`[Vigil Alert Dispatched] [${post.category}] ${post.title}`);
        await sleep(1000); // guard against rate-limit bursts
        return true;
    } catch (err) {
        console.error(`[Vigil Discord Error] Failed for ${post.url}:`, err.response?.data || err.message);
        return false;
    }
}

async function sendHeartbeat(webhookUrl, stats) {
    try {
        await axios.post(webhookUrl, { username: 'Vigil', embeds: [buildHeartbeatEmbed(stats, stats.uptimeSeconds)] });
        console.log('[Vigil Heartbeat] Weekly report dispatched.');
        return true;
    } catch (err) {
        console.error('[Vigil Heartbeat Error]', err.response?.data || err.message);
        return false;
    }
}

module.exports = { sendDiscordNotification, sendHeartbeat };