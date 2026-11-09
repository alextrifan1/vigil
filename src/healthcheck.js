const axios = require('axios');

/**
 * Pings a Healthchecks.io check after healthy sweeps. If the pings stop,
 * Healthchecks emails you, independent of Vigil, the server and Discord.
 */
function createHealthcheck(url, { post = axios.post, log = console } = {}) {
    async function ping() {
        if (!url) return false;
        try {
            await post(url, '', { timeout: 10000 });
            return true;
        } catch (err) {
            log.warn(`[Vigil Healthcheck] Ping failed: ${err.message}`);
            return false;
        }
    }

    return { ping, enabled: Boolean(url) };
}

module.exports = { createHealthcheck };