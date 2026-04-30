    // ─────────────────────────────────────────────────────────────────────────
    // 13 — M3U Playlist Import / Export
    // ─────────────────────────────────────────────────────────────────────────

    // ── Helpers ───────────────────────────────────────────────────────────────

    // Parse an M3U/M3U8 text blob into an array of entry objects.
    // Each entry: { title, artist, duration, rawPath }
    function parseM3UContent(text) {
        const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
        const entries = [];
        let pending = { title: '', artist: '', duration: 0 };

        for (const raw of lines) {
            const line = raw.trim();
            if (!line || line === '#EXTM3U') continue;

            if (line.startsWith('#EXTINF:')) {
                // #EXTINF:<duration>,<artist - title>  OR  #EXTINF:<duration>,<title>
                const rest = line.slice(8); // after "#EXTINF:"
                const commaIdx = rest.indexOf(',');
                pending.duration = commaIdx > -1 ? parseInt(rest.slice(0, commaIdx), 10) || 0 : 0;
                const label = commaIdx > -1 ? rest.slice(commaIdx + 1).trim() : '';
                const dashIdx = label.indexOf(' - ');
                if (dashIdx > -1) {
                    pending.artist = label.slice(0, dashIdx).trim();
                    pending.title  = label.slice(dashIdx + 3).trim();
                } else {
                    pending.artist = '';
                    pending.title  = label;
                }
            } else if (!line.startsWith('#')) {
                // This is a path/URL line
                entries.push({
                    title:    pending.title,
                    artist:   pending.artist,
                    duration: pending.duration,
                    rawPath:  line
                });
                pending = { title: '', artist: '', duration: 0 };
            }
        }
        return entries;
    }

    // Build M3U text from an array of tracks.
    function _buildM3UText(tracks) {
        const lines = ['#EXTM3U', ''];
        for (const track of tracks) {
            const durationSec = Math.round(Number(track.durationSec || 0)) || -1;
            const artist      = String(track.artist || '').trim();
            const title       = String(track.title  || '').trim();
            const label       = (artist && title) ? `${artist} - ${title}` : (title || artist || 'Unknown');
            const path        = String(track.path   || track.fileUrl || '').trim() || track.title || '';
            lines.push(`#EXTINF:${durationSec},${label}`);
            lines.push(path);
        }
        return lines.join('\n');
    }

    // Trigger a file download in the browser.
    function _downloadText(filename, text) {
        const blob = new Blob([text], { type: 'audio/x-mpegurl; charset=utf-8' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 1000);
    }

    // Sanitise a string for use as a filename (remove special chars, collapse spaces).
    function _safeFilename(name) {
        return String(name || 'playlist')
            .replace(/[\\/:*?"<>|]/g, '_')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 100) || 'playlist';
    }

    // ── Export ────────────────────────────────────────────────────────────────

    // Export a user playlist as an M3U file download.
    function exportPlaylistAsM3U(playlist) {
        if (!playlist) return;
        const tracks = Array.isArray(playlist.tracks) ? playlist.tracks : [];
        if (!tracks.length) {
            if (typeof showToast === 'function') showToast('Playlist is empty', 'warn');
            return;
        }
        const m3u = _buildM3UText(tracks);
        _downloadText(_safeFilename(playlist.name) + '.m3u', m3u);
    }

    // Export the current playback queue as an M3U file download.
    function exportQueueAsM3U() {
        const queue = Array.isArray(window.PLAYBACK_QUEUE) ? window.PLAYBACK_QUEUE
                    : (typeof getPlaybackQueue === 'function' ? getPlaybackQueue() : []);
        if (!queue || !queue.length) {
            if (typeof showToast === 'function') showToast('Queue is empty', 'warn');
            return;
        }
        const m3u = _buildM3UText(queue);
        _downloadText('queue.m3u', m3u);
    }

    // ── Import ────────────────────────────────────────────────────────────────

    // Try to match an M3U entry against the live library.
    // Strategy (in order):
    //   1. Exact title + artist match
    //   2. Title-only match (artist may be spelled differently)
    //   3. Filename match against track.path (basename)
    function _matchEntry(entry) {
        const normTitle  = String(entry.title  || '').toLowerCase().trim();
        const normArtist = String(entry.artist || '').toLowerCase().trim();
        const rawBasename = (entry.rawPath || '').split(/[/\\]/).pop().replace(/\.[^.]+$/, '').toLowerCase().trim();
        const tracks = Array.isArray(LIBRARY_TRACKS) ? LIBRARY_TRACKS : [];

        // 1. Exact title + artist
        if (normTitle && normArtist) {
            const exact = tracks.find((t) =>
                String(t.title  || '').toLowerCase().trim() === normTitle &&
                String(t.artist || '').toLowerCase().trim() === normArtist
            );
            if (exact) return exact;
        }

        // 2. Title-only
        if (normTitle) {
            const byTitle = tracks.find((t) =>
                String(t.title || '').toLowerCase().trim() === normTitle
            );
            if (byTitle) return byTitle;
        }

        // 3. Path basename
        if (rawBasename) {
            const byPath = tracks.find((t) => {
                const tBase = String(t.path || t.title || '').split(/[/\\]/).pop()
                    .replace(/\.[^.]+$/, '').toLowerCase().trim();
                return tBase && tBase === rawBasename;
            });
            if (byPath) return byPath;
        }

        return null;
    }

    // Open a file-picker and import an M3U/M3U8 playlist into the library.
    async function importM3UFile() {
        let fileHandle;
        try {
            if (typeof window.showOpenFilePicker === 'function') {
                const [handle] = await window.showOpenFilePicker({
                    types: [{ description: 'M3U Playlist', accept: { 'audio/x-mpegurl': ['.m3u', '.m3u8'] } }],
                    multiple: false
                });
                fileHandle = await handle.getFile();
            } else {
                // Fallback: hidden <input type="file">
                fileHandle = await new Promise((resolve, reject) => {
                    const input = document.createElement('input');
                    input.type   = 'file';
                    input.accept = '.m3u,.m3u8,audio/x-mpegurl,audio/mpegurl';
                    input.style.display = 'none';
                    document.body.appendChild(input);
                    input.addEventListener('change', () => {
                        document.body.removeChild(input);
                        if (input.files && input.files[0]) resolve(input.files[0]);
                        else reject(new Error('No file selected'));
                    });
                    input.addEventListener('cancel', () => {
                        document.body.removeChild(input);
                        reject(new Error('Cancelled'));
                    });
                    input.click();
                });
            }
        } catch (err) {
            if (err && err.message !== 'Cancelled') {
                console.warn('[M3U Import] File pick cancelled or failed:', err);
            }
            return;
        }

        let text;
        try {
            text = await fileHandle.text();
        } catch (err) {
            console.error('[M3U Import] Could not read file:', err);
            if (typeof showToast === 'function') showToast('Could not read file', 'error');
            return;
        }

        const entries = parseM3UContent(text);
        if (!entries.length) {
            if (typeof showToast === 'function') showToast('No tracks found in M3U file', 'warn');
            return;
        }

        // Derive playlist name from file name
        const rawFilename = String(fileHandle.name || 'Imported Playlist');
        const playlistName = rawFilename.replace(/\.m3u8?$/i, '').replace(/_/g, ' ').trim() || 'Imported Playlist';

        const createdPlaylist = typeof createUserPlaylist === 'function'
            ? createUserPlaylist(playlistName)
            : null;
        const playlistId = typeof createdPlaylist === 'string'
            ? createdPlaylist
            : createdPlaylist?.id || null;

        let matched   = 0;
        let unmatched = 0;

        for (const entry of entries) {
            const track = _matchEntry(entry);
            if (track && playlistId !== null && typeof addTrackToUserPlaylist === 'function') {
                addTrackToUserPlaylist(playlistId, track);
                matched++;
            } else {
                unmatched++;
            }
        }

        // Refresh library UI
        if (typeof renderLibraryViews === 'function') {
            renderLibraryViews({ forceRender: true });
        }

        const msg = unmatched === 0
            ? `Imported "${playlistName}" — ${matched} tracks`
            : `Imported "${playlistName}" — ${matched} matched, ${unmatched} not in library`;

        if (typeof showToast === 'function') {
            showToast(msg, 'info');
        } else {
            console.info('[M3U Import]', msg);
        }
    }
