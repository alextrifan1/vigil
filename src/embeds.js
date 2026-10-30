/**
 * Builders for Discord embeds. Pure: data in, embed object out.
 * `now` is a parameter so tests get deterministic timestamps.
 */

const FOOTER = { text: 'Vigil // Perimeter Watch' };

const COLORS = {
    master: 0xF1C40F, // gold
    licenta: 0x34495E, // slate grey
    healthy: 0x2ECC71, // green
    warning: 0xE67E22 // orange
};

function truncate(text, max) {
    return text.length > max ? `${text.substring(0, max - 3)}...` : text;
}

function buildPostEmbed(post, now = new Date()) {
    return {
        title: truncate(post.title, 250),
        url: post.url,
        color: post.category.includes('Master') ? COLORS.master : COLORS.licenta,
        description: `New posting detected on the **${post.category}** practice board.`,
        fields: [
            { name: 'Board', value: post.category, inline: true },
            { name: 'Date', value: post.date, inline: true }
        ],
        footer: FOOTER,
        timestamp: now.toISOString()
    };
}

function formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    return `${days}d ${hours}h`;
}

/** Returns the problems the heartbeat should flag. An empty list means healthy. */
function heartbeatWarnings(stats) {
    const warnings = [];
    if (stats.sweeps === 0) warnings.push('No sweeps ran since the last report.');
    if (stats.failedSweeps > 0) warnings.push(`${stats.failedSweeps} sweep(s) failed.`);
    if (stats.lastPostCount === 0) warnings.push('Last sweep found 0 posts. Scraper may be broken.');
    return warnings;
}

function buildHeartbeatEmbed(stats, uptimeSeconds, now = new Date()) {
    const warnings = heartbeatWarnings(stats);
    const lastSweep = stats.lastSweepAt ? `<t:${Math.floor(stats.lastSweepAt.getTime() / 1000)}:R>` : 'never';

    return {
        title: warnings.length ? 'Vigil weekly report: needs attention' : 'Vigil weekly report: all good',
        color: warnings.length ? COLORS.warning : COLORS.healthy,
        description: warnings.length ? warnings.map((w) => `• ${w}`).join('\n') : 'Still watching both boards.',
        fields: [
            { name: 'Sweeps', value: String(stats.sweeps), inline: true },
            { name: 'Alerts sent', value: String(stats.alerts), inline: true },
            { name: 'Tracked posts', value: String(stats.trackedCount), inline: true },
            { name: 'Last sweep', value: lastSweep, inline: true },
            { name: 'Uptime', value: formatUptime(uptimeSeconds), inline: true }
        ],
        footer: FOOTER,
        timestamp: now.toISOString()
    };
}

module.exports = { buildPostEmbed, buildHeartbeatEmbed, heartbeatWarnings, formatUptime, COLORS };