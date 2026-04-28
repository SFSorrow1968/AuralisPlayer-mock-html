/*
 * Auralis JS shard: 00a-runtime-logger.js
 * Purpose: Central runtime diagnostics used by storage, verification, and future debug UI.
 * Loads inside the IIFE opened by 00-shell-state-helpers.js, before library/playback shards.
 */
    const AURALIS_LOG_LIMIT = 250;
    const AuralisDiagnostics = (() => {
        const entries = [];

        function normalizeLevel(level) {
            return ['debug', 'info', 'warn', 'error'].includes(level) ? level : 'info';
        }

        function normalizeError(error) {
            if (!error) return null;
            if (error instanceof Error) {
                return { name: error.name, message: error.message, stack: error.stack || '' };
            }
            return { name: 'NonError', message: String(error), stack: '' };
        }

        function write(level, message, details) {
            const entry = Object.freeze({
                level: normalizeLevel(level),
                message: String(message || 'Auralis diagnostic event'),
                details: details || null,
                timestamp: Date.now()
            });
            entries.push(entry);
            if (entries.length > AURALIS_LOG_LIMIT) entries.shift();
            return entry;
        }

        function log(level, message, details) {
            return write(level, message, details || null);
        }

        function warn(message, details) {
            return write('warn', message, details || null);
        }

        function error(message, errorValue, details) {
            return write('error', message, Object.assign({}, details || {}, {
                error: normalizeError(errorValue)
            }));
        }

        function snapshot() {
            return entries.slice();
        }

        function clear() {
            entries.splice(0, entries.length);
        }

        return Object.freeze({ log, warn, error, snapshot, clear });
    })();

    const AuralisStrings = {};
    const AuralisRuntime = {
        diagnostics: AuralisDiagnostics,
        strings: AuralisStrings
    };
