const fs = require('fs');
const path = require('path');

/**
 * File-backed set of seen post IDs.
 * The file holds a JSON array of IDs. Writes go to a .tmp file first and are
 * then renamed, so a crash mid-write never leaves a corrupted state file.
 */

function createFileState(filePath, log = console) {
    function load() {
        fs.mkdirSync(path.dirname(filePath), { recursive: true });

        if (!fs.existsSync(filePath)) {
            return new Set();
        }
        try {
            return new Set(JSON.parse(fs.readFileSync(filePath, 'utf-8')));
        } catch {
            log.warn('[Vigil State] Invalid JSON in state file. Initializing fresh set.');
            return new Set();
        }
    }

    function save(seenSet) {
        const tmpFile = `${filePath}.tmp`;
        fs.writeFileSync(tmpFile, JSON.stringify([...seenSet], null, 2), 'utf-8');
        fs.renameSync(tmpFile, filePath);
    }

    return { load, save };
}

module.exports = { createFileState };