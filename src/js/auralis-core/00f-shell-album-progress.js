/*
 * Auralis JS shard: 00f-shell-album-progress.js
 * Purpose: album progress binding, URL resolution, playback health
 * Generated from auralis-core.js. Edit this file, then run scripts/build-core.ps1.
 */

    function ensureAlbumProgressBinding() {
        const trackEl = getEl('alb-progress-track');
        if (!trackEl || trackEl.dataset.bound === '1') return;
        trackEl.dataset.bound = '1';
        trackEl.addEventListener('click', (event) => {
            const rect = trackEl.getBoundingClientRect();
            const ratio = (event.clientX - rect.left) / Math.max(1, rect.width);
            seekAlbumProgress(ratio);
        });
    }

    function updateAlbumProgressLine(currentSeconds = 0, durationSeconds = 0) {
        const shell = getEl('alb-progress-shell');
        const fillEl = getEl('alb-progress-fill');
        const notchesEl = getEl('alb-progress-notches');
        if (!shell || !fillEl || !notchesEl) return;

        const albumMeta = resolveAlbumMeta(viewedAlbumTitle, viewedAlbumArtist);
        if (!albumMeta || !Array.isArray(albumMeta.tracks) || !albumMeta.tracks.length) {
            shell.style.display = 'none';
            fillEl.style.width = '0%';
            notchesEl.innerHTML = '';
            delete notchesEl.dataset.albumKey;
            delete notchesEl.dataset.layoutKey;
            return;
        }

        shell.style.display = 'block';
        const total = getAlbumTotalDurationSeconds(albumMeta);
        const albumKeyValue = getAlbumIdentityKey(albumMeta, albumMeta.artist);
        const layoutKey = `${albumKeyValue}:${albumMeta.tracks.length}:${Math.round(total)}`;
        if (notchesEl.dataset.layoutKey !== layoutKey) {
            renderAlbumProgressNotches(albumMeta);
            notchesEl.dataset.albumKey = albumKeyValue;
            notchesEl.dataset.layoutKey = layoutKey;
        }
        if (total <= 0) {
            fillEl.style.width = '0%';
            return;
        }

        const currentKey = getTrackIdentityKey(nowPlaying);
        const currentTrackIndex = albumMeta.tracks.findIndex((track) => getTrackIdentityKey(track) === currentKey);
        let elapsedBefore = 0;
        for (let i = 0; i < Math.max(0, currentTrackIndex); i += 1) {
            elapsedBefore += getTrackDurationSeconds(albumMeta.tracks[i]);
        }

        const segmentDuration = currentTrackIndex >= 0
            ? Math.max(1, getTrackDurationSeconds(albumMeta.tracks[currentTrackIndex]) || Number(durationSeconds || 0))
            : 0;
        const inTrack = currentTrackIndex >= 0
            ? Math.max(0, Math.min(segmentDuration, Number(currentSeconds || 0)))
            : 0;
        const elapsedAlbum = currentTrackIndex >= 0
            ? Math.max(0, Math.min(total, elapsedBefore + inTrack))
            : 0;
        const remainingAlbum = Math.max(0, total - elapsedAlbum);
        const ratio = currentTrackIndex >= 0
            ? Math.max(0, Math.min(1, elapsedAlbum / total))
            : 0;
        fillEl.style.width = `${ratio * 100}%`;

        Array.from(notchesEl.children).forEach((notch, idx) => {
            notch.classList.toggle('passed', currentTrackIndex >= 0 && idx < currentTrackIndex);
            notch.classList.toggle('current', currentTrackIndex >= 0 && idx === currentTrackIndex);
        });

        // Zenith specific: album-level elapsed/remaining with current track context
        const elapsedEl = document.getElementById('alb-progress-elapsed');
        const remainEl = document.getElementById('alb-progress-remaining');
        const currentTrackEl = document.getElementById('alb-progress-current-track');
        if (elapsedEl && remainEl && currentTrackEl) {
            elapsedEl.textContent = toDurationLabel(elapsedAlbum);
            remainEl.textContent = `-${toDurationLabel(remainingAlbum)}`;
            if (currentTrackIndex >= 0) {
                const track = albumMeta.tracks[currentTrackIndex];
                currentTrackEl.textContent = `${track.no || currentTrackIndex + 1}. ${track.title}`;
            } else {
                currentTrackEl.textContent = '';
            }
        }
    }

    function openInferredLongPressMenu(title, sub) {
        const label = String(title || '').trim();
        const subtitle = String(sub || '').trim();
        if (!label) return false;

        const artistHint = subtitle.split('-')[0].trim();
        const trackFromKey = artistHint ? trackByKey.get(trackKey(label, artistHint)) : null;
        if (trackFromKey) {
            openTrackZenithMenu(trackFromKey);
            return true;
        }

        const albumMeta = resolveAlbumMeta(label, artistHint);
        if (albumMeta) {
            openAlbumZenithMenu(albumMeta);
            return true;
        }

        const maybeTrack = LIBRARY_TRACKS.find(track => track.title === label && (!artistHint || toArtistKey(track.artist) === toArtistKey(artistHint)));
        if (maybeTrack) {
            openTrackZenithMenu(maybeTrack);
            return true;
        }

        const maybeArtist = artistByKey.get(toArtistKey(label))
            || artistByKey.get(toArtistKey(artistHint))
            || LIBRARY_ARTISTS.find(artist => toArtistKey(artist.name) === toArtistKey(label));
        if (maybeArtist) {
            openArtistZenithMenu(maybeArtist.name || label);
            return true;
        }

        return false;
    }

    function toSafeId(prefix) {
        return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
    }

    function toArtistKey(name) {
        return String(name || '').trim().toLowerCase();
    }

    function toPlaylistId(raw) {
        return `pl-${albumKey(raw)}`;
    }

    function getSectionCatalog() {
        return [
            // ── Core (defaults) ──
            { type: 'recent_activity', title: 'Recent Activity', itemType: 'songs', layout: 'list', density: 'compact', limit: 6, core: true },
            { type: 'recently_added', title: 'Recently Added', itemType: 'albums', layout: 'carousel', density: 'large', limit: 8, core: true },
            // ── Most Played ──
            { type: 'most_played_songs', title: 'Most Played Songs', itemType: 'songs', layout: 'list', density: 'compact', limit: 8 },
            { type: 'most_played_artists', title: 'Most Played Artists', itemType: 'artists', layout: 'carousel', density: 'large', limit: 8 },
            { type: 'most_played_albums', title: 'Most Played Albums', itemType: 'albums', layout: 'carousel', density: 'large', limit: 8 },
            // ── Jump Back In (in-progress albums) ──
            { type: 'jump_back_in', title: 'Jump Back In', itemType: 'albums', layout: 'carousel', density: 'large', limit: 6 },
            // ── Forgotten / rediscover ──
            { type: 'forgotten_songs', title: 'Forgotten Songs', itemType: 'songs', layout: 'list', density: 'compact', limit: 8 },
            { type: 'forgotten_albums', title: 'Forgotten Albums', itemType: 'albums', layout: 'carousel', density: 'large', limit: 8 },
            // ── Playlists ──
            { type: 'playlist_spotlight', title: 'Playlist Spotlight', itemType: 'playlists', layout: 'carousel', density: 'large', limit: 6 },
            // ── Never Played ──
            { type: 'never_played_songs', title: 'Never Played', itemType: 'songs', layout: 'list', density: 'compact', limit: 8 },
            { type: 'never_played_albums', title: 'Unplayed Albums', itemType: 'albums', layout: 'carousel', density: 'large', limit: 8 },
            // ── Liked / Ratings ──
            { type: 'liked_songs', title: 'Liked Songs', itemType: 'songs', layout: 'list', density: 'compact', limit: 8 },
            { type: 'top_rated', title: 'Top Rated', itemType: 'songs', layout: 'list', density: 'compact', limit: 8 },
            // ── Shuffle Mix ──
            { type: 'shuffle_mix', title: 'Shuffle Mix', itemType: 'songs', layout: 'carousel', density: 'large', limit: 8 },
            // ── In Progress Albums ──
            { type: 'in_progress_albums', title: 'In Progress', itemType: 'albums', layout: 'carousel', density: 'large', limit: 6 }
        ];
    }

    function getDefaultHomeSections() {
        return getSectionCatalog().filter(s => s.core).map(s => ({
            id: toSafeId(s.type),
            type: s.type,
            title: s.title,
            itemType: s.itemType,
            layout: s.layout,
            density: s.density,
            limit: s.limit,
            enabled: true,
            core: Boolean(s.core)
        }));
    }

    function getArtistSectionCatalog() {
        return [
            { type: 'artist_top_songs',  title: 'Top Tracks', itemType: 'songs',  layout: 'list',     density: 'compact', limit: 10, core: true },
            { type: 'artist_releases',   title: 'Releases',   itemType: 'albums', layout: 'carousel', density: 'large',   limit: 5,  core: true }
        ];
    }

    function getDefaultArtistProfileSections() {
        return getArtistSectionCatalog().map(s => ({
            id: toSafeId(s.type),
            type: s.type,
            title: s.title,
            itemType: s.itemType,
            layout: s.layout,
            density: s.density,
            limit: s.limit,
            enabled: true,
            core: true
        }));
    }

    function resolveArtUrlForContext(artUrl) {
        const raw = String(artUrl || '').trim();
        if (!raw) return '';
        const isHttpCtx = location.protocol === 'http:' || location.protocol === 'https:';
        if (isHttpCtx && /^file:\/\//i.test(raw)) return '';
        return raw;
    }

    function encodeMediaPathSegments(rawPath) {
        const normalized = normalizeRelativeDir(rawPath);
        if (!normalized) return '';
        return normalized
            .split('/')
            .filter(Boolean)
            .map(segment => {
                try {
                    return encodeURIComponent(decodeURIComponent(segment));
                } catch {
                    return encodeURIComponent(segment);
                }
            })
            .join('/');
    }

    function buildServedMusicUrl(rawPath) {
        const encodedPath = encodeMediaPathSegments(rawPath);
        return encodedPath ? `/music/${encodedPath}` : '';
    }

    function resolveMediaSourceForContext(fileUrl, track = null) {
        const raw = String(fileUrl || '').trim();
        const isHttpCtx = location.protocol === 'http:' || location.protocol === 'https:';
        if (!raw) return isHttpCtx ? buildServedMusicUrl(track?.path || '') : '';
        if (/^(blob:|data:|https?:)/i.test(raw)) return raw;
        if (isHttpCtx && /^file:\/\//i.test(raw)) return buildServedMusicUrl(track?.path || '');
        const servedMatch = raw.replace(/\\/g, '/').match(/^\/?music\/(.+)$/i);
        if (servedMatch) return buildServedMusicUrl(servedMatch[1]);
        if (isHttpCtx && !/^[a-z]+:/i.test(raw)) {
            return buildServedMusicUrl(track?.path || raw) || raw;
        }
        return raw;
    }

    // Resolve a playable URL for a track: try blob cache → handle key → file handle lookup → raw URL
    async function resolvePlayableUrl(track) {
        const key = getTrackPlaybackCacheKey(track);
        const handleKey = String(track?._handleKey || '').trim();
        const filename = extractFilename(track);
        if (DEBUG) console.log('[Auralis] resolvePlayableUrl:', track.title, '| _handleKey:', track._handleKey, '| handleCacheSize:', fileHandleCache.size);

        // 1. Check blob URL cache
        if (blobUrlCache.has(key)) return trackPlaybackBlobUrl(blobUrlCache.get(key));
        if (handleKey && blobUrlCache.has(handleKey)) {
            const cached = blobUrlCache.get(handleKey);
            if (key) blobUrlCache.set(key, cached);
            return trackPlaybackBlobUrl(cached);
        }
        if (filename && blobUrlCache.has(filename)) {
            const cached = blobUrlCache.get(filename);
            if (key) blobUrlCache.set(key, cached);
            return trackPlaybackBlobUrl(cached);
        }

        // 2. Direct handle key (scanned tracks have this)
        if (handleKey && fileHandleCache.has(handleKey)) {
            try {
                const handle = fileHandleCache.get(handleKey);
                // Fallback shim from <input webkitdirectory>
                if (handle && handle._blobUrl) {
                    if (key) blobUrlCache.set(key, handle._blobUrl);
                    blobUrlCache.set(handleKey, handle._blobUrl);
                    if (filename) blobUrlCache.set(filename, handle._blobUrl);
                    return trackPlaybackBlobUrl(handle._blobUrl);
                }
                const file = await handle.getFile();
                const blobUrl = URL.createObjectURL(file);
                if (key) blobUrlCache.set(key, blobUrl);
                blobUrlCache.set(handleKey, blobUrl);
                if (filename) blobUrlCache.set(filename, blobUrl);
                return trackPlaybackBlobUrl(blobUrl);
            } catch (e) {
                console.warn('Could not read file handle for', handleKey, e);
            }
        }

        // 3. Check if raw fileUrl or scanned relative path works directly.
        const direct = resolveMediaSourceForContext(track.fileUrl, track);
        if (direct) return direct;

        // 4. Try to find a matching file handle from scanned folders by filename
        if (filename && fileHandleCache.has(filename)) {
            try {
                const handle = fileHandleCache.get(filename);
                // Fallback shim from <input webkitdirectory>
                if (handle && handle._blobUrl) {
                    if (key) blobUrlCache.set(key, handle._blobUrl);
                    blobUrlCache.set(filename, handle._blobUrl);
                    if (handleKey) blobUrlCache.set(handleKey, handle._blobUrl);
                    return trackPlaybackBlobUrl(handle._blobUrl);
                }
                const file = await handle.getFile();
                const blobUrl = URL.createObjectURL(file);
                if (key) blobUrlCache.set(key, blobUrl);
                blobUrlCache.set(filename, blobUrl);
                if (handleKey) blobUrlCache.set(handleKey, blobUrl);
                return trackPlaybackBlobUrl(blobUrl);
            } catch (e) {
                console.warn('Could not read file handle for', filename, e);
            }
        }

        // 5. Fuzzy match: try matching by title keywords in filename
        if (track.title) {
            const titleNorm = track.title.toLowerCase().replace(/[^a-z0-9]/g, '');
            for (const [fname, handle] of fileHandleCache) {
                const fnameNorm = fname.toLowerCase().replace(/[^a-z0-9]/g, '');
                if (fnameNorm.includes(titleNorm) || titleNorm.includes(fnameNorm)) {
                    try {
                        // Fallback shim
                        if (handle && handle._blobUrl) {
                            if (key) blobUrlCache.set(key, handle._blobUrl);
                            blobUrlCache.set(fname, handle._blobUrl);
                            if (handleKey) blobUrlCache.set(handleKey, handle._blobUrl);
                            if (filename) blobUrlCache.set(filename, handle._blobUrl);
                            return trackPlaybackBlobUrl(handle._blobUrl);
                        }
                        const file = await handle.getFile();
                        const blobUrl = URL.createObjectURL(file);
                        if (key) blobUrlCache.set(key, blobUrl);
                        blobUrlCache.set(fname, blobUrl);
                        if (handleKey) blobUrlCache.set(handleKey, blobUrl);
                        fileHandleCache.set(filename || fname, handle);
                        return trackPlaybackBlobUrl(blobUrl);
                    } catch (_) { /* benign: cleanup */ }
                }
            }
        }

        return '';
    }

    // Extract a normalized filename from a track's path or fileUrl
    function extractFilename(track) {
        const src = track.path || track.fileUrl || '';
        if (!src) return '';
        try {
            // Handle file:// URLs
            const decoded = decodeURIComponent(src.replace(/^file:\/\/\//i, ''));
            const parts = decoded.replace(/\\/g, '/').split('/');
            return parts[parts.length - 1].toLowerCase();
        } catch (_) {
            return '';
        }
    }

    // Count how many indexed files currently have a matching file handle.
    function countPlayableLibraryTracks() {
        if (!Array.isArray(scannedFiles) || scannedFiles.length === 0 || fileHandleCache.size === 0) return 0;
        let count = 0;
        for (const file of scannedFiles) {
            const handleKey = getScannedFileHandleKey(file);
            const fname = String(file?.name || '').trim().toLowerCase();
            if ((handleKey && fileHandleCache.has(handleKey)) || (fname && fileHandleCache.has(fname))) count++;
        }
        return count;
    }

    function getPlaybackHealthStatus() {
        const scannedTrackCount = Array.isArray(scannedFiles) ? scannedFiles.length : 0;
        const playableTrackCount = countPlayableLibraryTracks();
        const needsRescan = scannedTrackCount > 0 && playableTrackCount === 0;
        const partiallyPlayable = scannedTrackCount > 0 && playableTrackCount > 0 && playableTrackCount < scannedTrackCount;
        const warningMessage = needsRescan
            ? 'Cached tracks are currently hidden because file access is stale. Open Settings and tap Scan Library.'
            : (partiallyPlayable
                ? `Only ${playableTrackCount} of ${scannedTrackCount} indexed tracks are currently playable. Scan Library to refresh handles.`
                : '');
        return {
            scannedTrackCount,
            playableTrackCount,
            needsRescan,
            partiallyPlayable,
            warningMessage
        };
    }

    function updatePlaybackHealthWarnings() {
        const status = getPlaybackHealthStatus();
        const showWarning = Boolean(status.warningMessage);

        const settingsWarning = getEl('settings-playback-warning');
        const settingsWarningText = getEl('settings-playback-warning-text');
        if (settingsWarning) settingsWarning.style.display = showWarning ? 'flex' : 'none';
        if (settingsWarningText && showWarning) settingsWarningText.textContent = status.warningMessage;

    }
