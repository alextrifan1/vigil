/**
 * One sweep: scrape the boards, alert on new posts, persist what was seen.
 *
 * All I/O is passed in, which is what makes this testable:
 *   scrape()      -> Promise<post[]>
 *   notify(post)  -> Promise<boolean>   (true = Discord accepted it)
 *   state         -> { load(): Set, save(Set) }
 *   stats         -> heartbeat counters
 *
 * Rules:
 *   - Empty state = cold start: index everything, send nothing.
 *   - A post is marked seen only after a successful notify, so failures retry next sweep.
 */

async function sweep({scrape, notify, state, stats, log = console}) {
    log.log(`[${new Date().toISOString()}] Vigil sweep initiated...`);

    const seenPosts = state.load();
    const isColdStart = seenPosts.size === 0;
    const currentPosts = await scrape();
    stats.lastPostCount = currentPosts.length;

    let newPostsCount = 0;

    for (const post of currentPosts) {
        if (seenPosts.has(post.id)) continue;

        if (isColdStart) {
            seenPosts.add(post.id);
            newPostsCount++;
            continue;
        }

        const sent = await notify(post);
        if (sent) {
            seenPosts.add(post.id);
            newPostsCount++;
            stats.alerts++;
        }
    }

    state.save(seenPosts);
    stats.sweeps++;
    stats.lastSweepAt = new Date();
    stats.trackedCount = seenPosts.size;

    if (isColdStart) {
        log.log(`[Vigil Cold Start] Baseline established. Indexed ${seenPosts.size} existing announcements.`);
    } else {
        log.log(`[Vigil Sweep Complete] ${newPostsCount} new item(s) found. Total tracked: ${seenPosts.size}.`);
    }
}

/**
 * Wraps a sweep so that runs never overlap and errors are counted, not thrown.
 * Returns a function suitable for cron.schedule().
 */

function createSweepRunner(runOnce, stats, log = console) {
    let sweeping = false;

    return async function runSweep() {
        if (sweeping) {
            log.warn('[Vigil] Previous sweep still running. Skipping this tick.');
            return;
        }
        sweeping = true;
        try {
            await runOnce();
        } catch (err) {
            stats.failedSweeps++;
            log.error(err);
        } finally {
            sweeping = false;
        }
    };
}

module.exports = { sweep, createSweepRunner };