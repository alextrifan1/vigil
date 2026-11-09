/**
 * In-memory counters reported by the weekly heartbeat.
 * They live only as long as the process, so a restart resets them
 * (the heartbeat's uptime field makes that visible).
 */
function createStats() {
    return {
        sweeps: 0,
        failedSweeps: 0,
        alerts: 0,
        lastSweepAt: null,
        lastPostCount: 0,
        trackedCount: 0
    };
}

/** Resets the per-period counters after a heartbeat was delivered. */
function resetPeriod(stats) {
    stats.sweeps = 0;
    stats.failedSweeps = 0;
    stats.alerts = 0;
}

/** A sweep is healthy when it found posts. 0 posts means the boards failed or the parser broke. */
function isHealthy(stats) {
    return stats.lastPostCount > 0;
}

module.exports = { createStats, resetPeriod, isHealthy };