/*
 * Auralis JS shard: 01-library-scan-metadata.js
 * Purpose: scan-to-library merge, duration probing, artwork, featured albums
 * Generated from auralis-core.js. Edit this file, then run scripts/build-core.ps1.
 */
    // â”€â”€ Build library entries from scanned files â”€â”€

    function parseTrackFilename(filename) {
        // Strip extension
        const base = filename.replace(/\.[^.]+$/, '');
        // Try "NN Title" or "NN. Title" or "NN - Title" patterns
        const numMatch = base.match(/^(\d{1,3})[\s.\-_]+(.+)$/);
        if (numMatch) {
            return { no: parseInt(numMatch[1], 10), title: numMatch[2].trim() };
        }
        // Try "Artist - Title" pattern
        const dashMatch = base.match(/^(.+?)\s*-\s*(.+)$/);
        if (dashMatch) {
            return { no: 0, title: dashMatch[2].trim(), parsedArtist: dashMatch[1].trim() };
        }
        return { no: 0, title: base.trim() };
    }

    function resetPlaybackState() {
        queueTracks = LIBRARY_TRACKS.slice(0, DEFAULT_QUEUE_SIZE);
        queueIndex = 0;
        nowPlaying = queueTracks[0] || null;
        if (nowPlaying) {
            setNowPlaying(nowPlaying, false);
        } else {
            clearNowPlayingState();
        }
        renderQueue();
    }

    function clearNowPlayingState() {
        nowPlaying = null;
        setPlaybackCollection('', '');
        activeArtistName = LIBRARY_ARTISTS[0]?.name || ARTIST_NAME;

        document.querySelectorAll('.mini-title').forEach(el => { setNowPlayingMarqueeText(el, 'No track selected'); });
        document.querySelectorAll('.mini-artist').forEach(el => { setNowPlayingMarqueeText(el, 'Add a folder and run Rescan Library'); });

        const pt = getEl('player-title') || document.querySelector('.player-titles h1');
        const pa = getEl('player-artist') || document.querySelector('.player-titles p');
        if (pt) setNowPlayingMarqueeText(pt, 'No track selected');
        if (pa) setNowPlayingMarqueeText(pa, 'Add a folder and run Rescan Library');
        scheduleNowPlayingMarquee(document);

        const quality = getEl('player-quality-badge');
        const format = getEl('player-format-badge');
        if (quality) quality.textContent = 'READY';
        if (format) format.textContent = 'AUDIO';

        const elapsed = getEl('player-elapsed');
        const remaining = getEl('player-remaining');
        if (elapsed) elapsed.textContent = '0:00';
        if (remaining) remaining.textContent = '--:--';

        syncNowPlayingArt(null);
        updateProgressUI(0, 0);
        setPlayButtonState(false);
    }

    function rebuildSearchData() {
        const featuredAlbums = getFeaturedAlbums();
        const songResults = LIBRARY_TRACKS.slice(0, 14).map((track, i) => ({
            title: track.title,
            subtitle: `${track.artist} - ${track.duration}`,
            artist: track.artist,
            albumTitle: track.albumTitle,
            genre: track.genre || '',
            type: 'songs',
            plays: track.plays || (220 - i * 8),
            duration: track.durationSec || 0,
            added: Math.max(1, 120 - i),
            artUrl: track.artUrl || '',
            action: () => playTrack(track.title, track.artist, track.albumTitle)
        }));
        const albumResults = featuredAlbums.slice(0, 8).map((album, i) => ({
            title: album.title,
            subtitle: `${album.artist} - ${album.trackCount} tracks`,
            artist: album.artist,
            albumTitle: album.title,
            year: album.year || '',
            tracks: Array.isArray(album.tracks) ? album.tracks.slice() : [],
            trackCount: album.trackCount,
            genre: album.genre || '',
            type: 'albums',
            plays: 180 - (i * 12),
            duration: Number(album.tracks[0]?.durationSec || 0),
            added: Math.max(1, 60 - i),
            artUrl: album.artUrl || '',
            action: () => navToAlbum(album.title, album.artist)
        }));

        const primaryArtist = LIBRARY_ARTISTS[0]?.name || LIBRARY_ALBUMS[0]?.artist || '';
        const artistResults = primaryArtist ? [{
            title: primaryArtist,
            subtitle: `Artist - ${LIBRARY_ALBUMS.length} albums`,
            artist: primaryArtist,
            name: primaryArtist,
            albumCount: LIBRARY_ALBUMS.length,
            trackCount: LIBRARY_TRACKS.length,
            type: 'artists',
            plays: Math.max(500, Number(LIBRARY_ARTISTS[0]?.plays || 0)),
            duration: 0,
            added: 1,
            artUrl: LIBRARY_ARTISTS[0]?.artUrl || featuredAlbums[0]?.artUrl || '',
            action: () => routeToArtistProfile(primaryArtist)
        }] : [];

        SEARCH_DATA = [
            ...songResults,
            ...albumResults,
            ...artistResults
        ];
    }

    async function syncLibraryFromMediaState() {
        if (scannedFiles.length > 0) {
            if (fileHandleCache.size === 0) {
                // Keep stale caches out of view until handles can be rebuilt or user rescans.
                hydrateLibraryData();
                resetPlaybackState();
                renderHomeSections();
                renderLibraryViews();
                syncEmptyState();
                updatePlaybackHealthWarnings();
                return;
            }
            await mergeScannedIntoLibrary();
            return;
        }
        if (fileHandleCache.size > 0) {
            await mergeScannedIntoLibrary();
            return;
        }
        clearDemoMarkup();
        hydrateLibraryData();
        resetPlaybackState();
        renderHomeSections();
        renderLibraryViews();
        syncEmptyState();
        updatePlaybackHealthWarnings();
    }

    let _mergeInProgress = false;

    async function mergeScannedIntoLibrary() {
        if (fileHandleCache.size === 0 && scannedFiles.length === 0) return;
        if (_mergeInProgress) return;
        _mergeInProgress = true;
        try {
        if (DEBUG) console.log('[Auralis] mergeScannedIntoLibrary: scannedFiles=' + scannedFiles.length + ', fileHandleCache=' + fileHandleCache.size + ', artHandleCache=' + artHandleCache.size);

        // Group scanned files by subdirectory (each subfolder = an album)
        const folderMap = new Map();
        for (const folder of mediaFolders) {
            folderMap.set(folder.id, folder);
        }

        const albumMap = new Map(); // folderId + relative subDir â†’ album grouping
        for (const file of scannedFiles) {
            const normalizedDir = normalizeRelativeDir(file.subDir);
            const groupKey = normalizedDir ? `${file.folderId}::${normalizedDir}` : String(file.folderId);
            if (!albumMap.has(groupKey)) {
                const folder = folderMap.get(file.folderId);
                albumMap.set(groupKey, {
                    albumName: getAlbumFolderName(file.subDir, folder ? folder.name : 'Unknown Folder'),
                    parentFolderName: getAlbumParentName(file.subDir, folder ? folder.name : ''),
                    artKey: getArtCacheKey(file.folderId, file.subDir),
                    files: []
                });
            }
            albumMap.get(groupKey).files.push(file);
        }

        // Fallback: if scannedFiles empty but handles exist (boot rebuild without IDB scanned files)
        if (albumMap.size === 0 && fileHandleCache.size > 0) {
            albumMap.set('_handles', {
                albumName: mediaFolders.length > 0 ? mediaFolders[0].name : 'Music',
                parentFolderName: '',
                files: (Array.from(fileHandleCache.keys()).filter((key) => key.includes('::')).length > 0
                    ? Array.from(fileHandleCache.keys()).filter((key) => key.includes('::'))
                    : Array.from(fileHandleCache.keys())
                ).map((cacheKey) => ({
                    name: cacheKey.includes('::') ? cacheKey.split('::').pop() : cacheKey,
                    folderId: '_handles',
                    subDir: '',
                    size: 0,
                    type: 'audio/' + ((cacheKey.includes('::') ? cacheKey.split('::').pop() : cacheKey).split('.').pop() || 'unknown'),
                    lastModified: Date.now()
                }))
            });
        }

        if (DEBUG) console.log('[Auralis] Album groups found:', albumMap.size, Array.from(albumMap.keys()));

        // Majority-vote helper: returns the most frequent non-empty string
        function majorityVote(values) {
            const counts = new Map();
            for (const v of values) {
                const s = String(v || '').trim();
                if (!s) continue;
                counts.set(s, (counts.get(s) || 0) + 1);
            }
            let best = '';
            let bestCount = 0;
            for (const [val, count] of counts) {
                if (count > bestCount) { best = val; bestCount = count; }
            }
            return best;
        }

        const newAlbums = [];
        let trackIdx = 0;
        for (const [groupKey, group] of albumMap) {
            // Sort files naturally (by name, which typically includes track numbers)
            const sorted = group.files.slice().sort((a, b) =>
                a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
            );

            const artistGuess = group.parentFolderName || group.albumName;

            // â”€â”€ Read embedded metadata (ID3v2 / Vorbis Comment / MP4 atoms) â”€â”€
            // This gives us real title, artist, album, year, genre, track#, and embedded art.
            const rawTracks = [];

            for (let idx = 0; idx < sorted.length; idx++) {
                const file = sorted[idx];
                const parsed = parseTrackFilename(file.name);
                const ext = file.name.split('.').pop().toLowerCase();
                const handleKey = getScannedFileHandleKey(file) || file.name.toLowerCase();
                trackIdx++;

                // Attempt to read embedded tags from the actual file bytes
                let embeddedMeta = { title: '', artist: '', album: '', year: '', genre: '', trackNo: 0, artBlobUrl: '' };
                const handle = fileHandleCache.get(handleKey) || fileHandleCache.get(file.name.toLowerCase());
                if (handle && typeof handle.getFile === 'function') {
                    try {
                        const fileObj = await handle.getFile();
                        if (fileObj) embeddedMeta = await readEmbeddedMetadata(fileObj);
                    } catch (e) {
                        if (DEBUG) console.warn('[Auralis] Could not read embedded metadata for', file.name, e);
                    }
                }

                // Prefer embedded tags; fall back to filename parsing
                const title   = embeddedMeta.title   || parsed.title;
                const artist  = embeddedMeta.artist  || parsed.parsedArtist || artistGuess;
                const album   = embeddedMeta.album   || group.albumName;
                const year    = embeddedMeta.year    || '';
                const genre   = embeddedMeta.genre   || '';
                const trackNo = embeddedMeta.trackNo || parsed.no || (idx + 1);

                rawTracks.push({
                    no:             trackNo,
                    title,
                    artist,
                    albumTitle:     album,
                    year,
                    genre,
                    duration:       '--:--',
                    durationSec:    0,
                    ext,
                    artUrl:         embeddedMeta.artBlobUrl || '',
                    fileUrl:        '',
                    path:           '',
                    plays:          100 + trackIdx,
                    addedRank:      1000 + trackIdx,
                    lastPlayedDays: 1,
                    _scanned:       true,
                    _handleKey:     handleKey
                });
            }

            if (rawTracks.length === 0) continue;

            // Regroup tracks by their embedded album tag.
            // Tracks in the same folder may belong to different albums per their tags.
            const subAlbumMap = new Map();
            for (const track of rawTracks) {
                const albumTagKey = (track.albumTitle || group.albumName).trim().toLowerCase();
                if (!subAlbumMap.has(albumTagKey)) {
                    subAlbumMap.set(albumTagKey, []);
                }
                subAlbumMap.get(albumTagKey).push(track);
            }

            let subAlbumIdx = 0;
            for (const [, subTracks] of subAlbumMap) {
                // Sort sub-album tracks by track number, then by filename-based order
                subTracks.sort((a, b) => (a.no || 999) - (b.no || 999));

                // Per-track art: each track keeps only its own embedded art.
                // Album-level art uses the first available art from the sub-group.
                const subAlbumArt = subTracks.find(t => t.artUrl)?.artUrl || '';

                // Backfill: give tracks without embedded art the album-level art
                if (subAlbumArt) subTracks.forEach(t => { if (!t.artUrl) t.artUrl = subAlbumArt; });

                // Determine album-level metadata via majority vote across this sub-album's tracks
                const albumTitle  = majorityVote(subTracks.map(t => t.albumTitle)) || group.albumName;
                const albumArtist = majorityVote(subTracks.map(t => t.artist)) || artistGuess;
                const albumYear   = majorityVote(subTracks.map(t => t.year))   || '';
                const albumGenre  = majorityVote(subTracks.map(t => t.genre))  || '';

                // Ensure each track's own albumTitle is preserved (do NOT overwrite with album-level title).
                // Only backfill tracks that have no albumTitle at all.
                subTracks.forEach(t => { if (!t.albumTitle) t.albumTitle = albumTitle; });

                const subKey = subAlbumMap.size > 1 ? `${groupKey}__sub${subAlbumIdx}` : groupKey;
                subAlbumIdx++;

                newAlbums.push({
                    id:                '_scanned_' + subKey,
                    title:             albumTitle,
                    artist:            albumArtist,
                    year:              albumYear,
                    genre:             albumGenre,
                    artUrl:            subAlbumArt,
                    trackCount:        subTracks.length,
                    totalDurationLabel: toLibraryDurationTotal(subTracks),
                    tracks:            subTracks,
                    _artKey:           group.artKey,
                    _scanned:          true
                });
            }
        }

        if (DEBUG) console.log('[Auralis] Built ' + newAlbums.length + ' scanned albums, ' + trackIdx + ' total tracks');
        if (newAlbums.length > 0 && DEBUG) {
            newAlbums.forEach(a => console.log('[Auralis]   Album: "' + a.title + '" â€” ' + a.trackCount + ' tracks, embedded art: ' + Boolean(a.artUrl)));
        }

        // Resolve sidecar album art (cover.jpg / folder.png etc.).
        // Prefer folder artwork for album cards; embedded art remains the per-track fallback.
        // Cache resolved blob URLs by artKey so sub-albums from the same folder share one URL.
        const sidecarBlobCache = new Map();
        for (const album of newAlbums) {
            // Check if we already resolved sidecar art for this folder
            if (album._artKey && sidecarBlobCache.has(album._artKey)) {
                const cachedUrl = sidecarBlobCache.get(album._artKey);
                album.artUrl = cachedUrl;
                album.tracks.forEach(t => { if (!t.artUrl) t.artUrl = cachedUrl; });
                continue;
            }

            const artHandle = album._artKey ? artHandleCache.get(album._artKey) : null;
            if (!artHandle) continue;
            try {
                let artBlobUrl;
                if (artHandle._blobUrl) {
                    artBlobUrl = artHandle._blobUrl;
                } else {
                    const artFile = await artHandle.getFile();
                    artBlobUrl = URL.createObjectURL(artFile);
                }
                album.artUrl = artBlobUrl;
                album.tracks.forEach(t => { if (!t.artUrl) t.artUrl = artBlobUrl; });
                if (album._artKey) sidecarBlobCache.set(album._artKey, artBlobUrl);
                if (DEBUG) console.log('[Auralis]   Sidecar art for "' + album.title + '"');
            } catch (e) {
                console.warn('[Auralis]   Could not load sidecar art for "' + album.title + '":', e);
            }
        }

        // When user has real scanned music, replace the current in-memory library.
        if (newAlbums.length > 0) {
            LIBRARY_ALBUMS = newAlbums;
        } else {
            // No scanned albums found, keep existing library
            return;
        }

        // Rebuild indexes
        albumByTitle.clear();
        trackByKey.clear();
        LIBRARY_TRACKS = [];

        LIBRARY_ALBUMS.forEach(album => {
            albumByTitle.set(albumKey(album.title), album);
            album.tracks.forEach(track => {
                LIBRARY_TRACKS.push(track);
                const k = trackKey(track.title, track.artist);
                if (!trackByKey.has(k)) trackByKey.set(k, track);
            });
        });

        // Rebuild artist list — use the most-played album's cover as artist art
        const artistMap = new Map();
        LIBRARY_TRACKS.forEach(track => {
            const key = toArtistKey(track.artist);
            if (!artistMap.has(key)) {
                artistMap.set(key, {
                    name: track.artist,
                    artUrl: '',
                    trackCount: 0,
                    albumSet: new Set(),
                    plays: 0,
                    lastPlayedDays: track.lastPlayedDays || 999
                });
            }
            const artistMeta = artistMap.get(key);
            artistMeta.trackCount += 1;
            artistMeta.albumSet.add(track.albumTitle);
            artistMeta.plays += Number(track.plays || 0);
            artistMeta.lastPlayedDays = Math.min(artistMeta.lastPlayedDays, Number(track.lastPlayedDays || 999));
        });
        // Assign artist art from most-played album with art
        for (const [key, artistMeta] of artistMap) {
            const artistAlbums = LIBRARY_ALBUMS
                .filter(a => toArtistKey(a.artist) === key && a.artUrl)
                .sort((a, b) => {
                    const aPlays = (a.tracks || []).reduce((s, t) => s + Number(t.plays || 0), 0);
                    const bPlays = (b.tracks || []).reduce((s, t) => s + Number(t.plays || 0), 0);
                    return bPlays - aPlays;
                });
            if (artistAlbums.length > 0) {
                artistMeta.artUrl = artistAlbums[0].artUrl;
            } else {
                // Fallback: first track with art
                const firstWithArt = LIBRARY_TRACKS.find(t => toArtistKey(t.artist) === key && t.artUrl);
                if (firstWithArt) artistMeta.artUrl = firstWithArt.artUrl;
            }
        }
        LIBRARY_ARTISTS = Array.from(artistMap.values()).map(artist => ({
            name: artist.name,
            artUrl: artist.artUrl,
            trackCount: artist.trackCount,
            albumCount: artist.albumSet.size,
            plays: artist.plays,
            lastPlayedDays: artist.lastPlayedDays
        })).sort((a, b) => b.plays - a.plays);
        artistByKey.clear();
        LIBRARY_ARTISTS.forEach(artist => artistByKey.set(toArtistKey(artist.name), artist));

        // Rebuild playlists from scanned albums
        LIBRARY_PLAYLISTS = LIBRARY_ALBUMS.slice(0, 12).map((album, idx) => ({
            id: toPlaylistId(album.title),
            title: idx === 0 ? 'On Repeat' : album.title,
            subtitle: idx === 0 ? 'Songs you love right now' : `${album.trackCount} tracks`,
            artist: album.artist,
            artUrl: album.artUrl,
            tracks: album.tracks.slice(),
            sourceType: idx === 0 ? 'playlist' : 'album_proxy',
            sourceAlbumTitle: album.title,
            sourceAlbumArtist: album.artist,
            plays: album.tracks.reduce((sum, t) => sum + Number(t.plays || 0), 0),
            lastPlayedDays: Math.min(...album.tracks.map(t => Number(t.lastPlayedDays || 999)))
        }));
        playlistById.clear();
        LIBRARY_PLAYLISTS.forEach(playlist => playlistById.set(playlist.id, playlist));
        rebuildSearchData();

        if (DEBUG) console.log('[Auralis] Library rebuilt: ' + LIBRARY_ALBUMS.length + ' albums, ' + LIBRARY_TRACKS.length + ' tracks, ' + LIBRARY_ARTISTS.length + ' artists');

        resetPlaybackState();
        renderHomeSections();
        renderLibraryViews();
        syncEmptyState();
        updatePlaybackHealthWarnings();

        // Probe durations in background (re-renders when complete to show durations)
        probeDurationsInBackground(newAlbums.flatMap(a => a.tracks));
        } finally {
            _mergeInProgress = false;
        }
    }

    // Background duration probing via hidden Audio element
    async function probeDurationsInBackground(tracks) {
        if (!tracks || tracks.length === 0) return;
        const audio = document.createElement('audio');
        audio.preload = 'metadata';
        let failedCount = 0;

        for (const track of tracks) {
            if (track.durationSec > 0) continue;
            const handleKey = track._handleKey;
            if (!handleKey) continue;

            let blobUrl = null;
            let createdBlob = false;

            try {
                // Check existing blob URL cache first
                if (blobUrlCache.has(handleKey)) {
                    blobUrl = blobUrlCache.get(handleKey);
                } else if (fileHandleCache.has(handleKey)) {
                    const handle = fileHandleCache.get(handleKey);
                    if (handle && handle._blobUrl) {
                        // Fallback shim: reuse the blob URL directly
                        blobUrl = handle._blobUrl;
                    } else if (handle && typeof handle.getFile === 'function') {
                        const file = await handle.getFile();
                        blobUrl = URL.createObjectURL(file);
                        createdBlob = true;
                    }
                } else {
                    continue;
                }

                if (!blobUrl) continue;

                await new Promise((resolve) => {
                    const cleanup = () => {
                        if (createdBlob) URL.revokeObjectURL(blobUrl);
                        audio.removeEventListener('loadedmetadata', onMeta);
                        audio.removeEventListener('error', onErr);
                        audio.src = '';
                        resolve();
                    };
                    const onMeta = () => {
                        if (Number.isFinite(audio.duration) && audio.duration > 0) {
                            track.durationSec = Math.round(audio.duration);
                            track.duration = toDurationLabel(track.durationSec);
                        }
                        cleanup();
                    };
                    const onErr = () => { failedCount++; cleanup(); };
                    audio.addEventListener('loadedmetadata', onMeta, { once: true });
                    audio.addEventListener('error', onErr, { once: true });
                    audio.src = blobUrl;
                    audio.load();
                    setTimeout(cleanup, 8000);
                });
            } catch (_) {
                failedCount++;
                continue;
            }
        }

        if (failedCount > 0) {
            toast(failedCount + ' track' + (failedCount > 1 ? 's' : '') + ' could not be probed for duration');
        }

        // After probing, update any visible album duration labels
        LIBRARY_ALBUMS.filter(a => a._scanned).forEach(album => {
            album.totalDurationLabel = toLibraryDurationTotal(album.tracks);
        });

        // Re-render to show probed durations
        renderHomeSections();
        renderLibraryViews();
    }

    function applyArtBackground(el, artUrl, fallback = FALLBACK_GRADIENT) {
        if (!el) return;
        const resolvedUrl = resolveArtUrlForContext(artUrl);
        if (resolvedUrl) {
            el.style.background = '';
            el.style.backgroundImage = `linear-gradient(rgba(0,0,0,.2), rgba(0,0,0,.25)), url("${resolvedUrl}")`;
            el.style.backgroundSize = 'cover';
            el.style.backgroundPosition = 'center';
            el.style.backgroundRepeat = 'no-repeat';
        } else if (fallback) {
            el.style.backgroundImage = '';
            el.style.background = fallback;
        }
    }

    function getNowPlayingArtUrl(meta = nowPlaying) {
        if (!meta) return '';
        const direct = resolveArtUrlForContext(meta.artUrl || '');
        if (direct) return direct;

        const hintedAlbum = meta.albumTitle || '';
        if (hintedAlbum) {
            const albumMeta = resolveAlbumMeta(hintedAlbum);
            if (albumMeta?.artUrl) {
                const albumArt = resolveArtUrlForContext(albumMeta.artUrl);
                if (albumArt) return albumArt;
            }
        }

        const keyed = trackByKey.get(trackKey(meta.title, meta.artist));
        const keyedArt = resolveArtUrlForContext(keyed?.artUrl || '');
        if (keyedArt) return keyedArt;

        const currentIdx = getCurrentQueueIndex();
        if (currentIdx >= 0 && currentIdx < queueTracks.length) {
            const queueArt = resolveArtUrlForContext(queueTracks[currentIdx]?.artUrl || '');
            if (queueArt) return queueArt;
        }
        return '';
    }

    function syncNowPlayingArt(meta = nowPlaying) {
        const artUrl = getNowPlayingArtUrl(meta);
        const fallbackArt = FALLBACK_GRADIENT;
        const fallbackBg = 'radial-gradient(ellipse at top, #302b63 0%, #0f0f0f 70%)';

        const miniArt = getEl('mini-art');
        const playerArt = getEl('player-art');
        const playerBg = getEl('player-bg');

        applyArtBackground(miniArt, artUrl, fallbackArt);
        applyArtBackground(playerArt, artUrl, fallbackArt);
        applyArtBackground(playerBg, artUrl, fallbackBg);

        if (playerArt) {
            playerArt.style.display = 'block';
            playerArt.style.opacity = '1';
        }
    }

    function getFeaturedAlbums() {
        const featured = [];
        const seen = new Set();
        LIBRARY_ALBUMS.forEach(album => {
            if (featured.length >= 8) return;
            const key = albumKey(album.title);
            if (seen.has(key)) return;
            seen.add(key);
            featured.push(album);
        });

        return featured;
    }
