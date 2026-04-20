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

    let activeLibraryScanOperation = null;
    let nextLibraryScanOperationId = 0;

    function snapshotStructuralSignature(albums) {
        return JSON.stringify((Array.isArray(albums) ? albums : []).map((album) => ({
            albumKey: `${albumKey(album?.title)}::${toArtistKey(album?.artist)}`,
            tracks: (Array.isArray(album?.tracks) ? album.tracks : []).map((track) => trackKey(track?.title, track?.artist))
        })));
    }
    function isLibrarySnapshotStructurallyDifferent(albums) {
        return snapshotStructuralSignature(albums) !== libraryStructureSignature;
    }

    function beginLibraryScanOperation() {
        if (activeLibraryScanOperation) {
            activeLibraryScanOperation.canceled = true;
            revokeUrlSet(activeLibraryScanOperation.createdBlobUrls);
        }
        const operation = {
            id: ++nextLibraryScanOperationId,
            canceled: false,
            createdBlobUrls: new Set(),
            lastCommitAt: Date.now()
        };
        activeLibraryScanOperation = operation;
        return operation;
    }

    function isLibraryScanActive(operation) {
        return Boolean(operation && !operation.canceled && activeLibraryScanOperation === operation);
    }

    function ensureLibraryScanActive(operation) {
        if (!isLibraryScanActive(operation)) {
            throw new Error('__AURALIS_SCAN_CANCELED__');
        }
    }

    function finishLibraryScanOperation(operation) {
        if (activeLibraryScanOperation === operation) {
            activeLibraryScanOperation = null;
        }
    }

    function updateLibrarySnapshotArtworkOwnership(albums, scanOperation = null) {
        const nextUrls = collectSnapshotArtworkUrls(albums);
        librarySnapshotArtworkUrls.forEach((url) => {
            if (!nextUrls.has(url)) revokeObjectUrl(url);
        });
        librarySnapshotArtworkUrls = nextUrls;
        if (scanOperation) {
            nextUrls.forEach((url) => scanOperation.createdBlobUrls.delete(url));
        }
    }

    function buildLibrarySnapshotIndexes(albums = LIBRARY_ALBUMS) {
        const snapshotAlbums = Array.isArray(albums) ? albums : [];
        const nextAlbumByTitle = new Map();
        const nextTrackByKey = new Map();
        const nextTracks = [];

        snapshotAlbums.forEach((album) => {
            const artistCounts = new Map();
            (Array.isArray(album?.tracks) ? album.tracks : []).forEach((track) => {
                const candidateArtist = getCanonicalTrackArtistName(track, album.artist);
                const key = toArtistKey(candidateArtist);
                if (!key) return;
                artistCounts.set(candidateArtist, (artistCounts.get(candidateArtist) || 0) + 1);
            });
            if (artistCounts.size) {
                album.artist = Array.from(artistCounts.entries()).sort((a, b) => b[1] - a[1])[0][0];
            }
            nextAlbumByTitle.set(albumKey(album.title), album);
            album.tracks.forEach((track) => {
                const canonicalArtist = getCanonicalTrackArtistName(track, album.artist);
                if (canonicalArtist && canonicalArtist !== track.artist) track.artist = canonicalArtist;
                nextTracks.push(track);
                const key = trackKey(track.title, track.artist);
                if (!nextTrackByKey.has(key)) nextTrackByKey.set(key, track);
            });
        });

        const artistMap = new Map();
        nextTracks.forEach((track) => {
            const artistName = getCanonicalTrackArtistName(track);
            const key = toArtistKey(artistName);
            if (!artistMap.has(key)) {
                artistMap.set(key, {
                    name: artistName,
                    artUrl: '',
                    trackCount: 0,
                    albumSet: new Set(),
                    plays: 0,
                    lastPlayedDays: track.lastPlayedDays || 999
                });
            }
            const meta = artistMap.get(key);
            meta.trackCount += 1;
            meta.albumSet.add(track.albumTitle);
            meta.plays += Number(track.plays || 0);
            meta.lastPlayedDays = Math.min(meta.lastPlayedDays, Number(track.lastPlayedDays || 999));
        });

        for (const [key, artistMeta] of artistMap) {
            const artistAlbums = snapshotAlbums
                .filter((album) => toArtistKey(album.artist) === key && album.artUrl)
                .sort((a, b) => {
                    const aPlays = (a.tracks || []).reduce((sum, track) => sum + Number(track.plays || 0), 0);
                    const bPlays = (b.tracks || []).reduce((sum, track) => sum + Number(track.plays || 0), 0);
                    return bPlays - aPlays;
                });
            if (artistAlbums.length > 0) {
                artistMeta.artUrl = artistAlbums[0].artUrl;
            } else {
                const firstWithArt = nextTracks.find((track) => toArtistKey(track.artist) === key && track.artUrl);
                if (firstWithArt) artistMeta.artUrl = firstWithArt.artUrl;
            }
        }

        const nextArtists = Array.from(artistMap.values()).map((artist) => ({
            name: artist.name,
            artUrl: artist.artUrl,
            trackCount: artist.trackCount,
            albumCount: artist.albumSet.size,
            plays: artist.plays,
            lastPlayedDays: artist.lastPlayedDays
        })).sort((a, b) => b.plays - a.plays);

        const nextArtistByKey = new Map();
        nextArtists.forEach((artist) => nextArtistByKey.set(toArtistKey(artist.name), artist));

        const nextPlaylists = [];
        const nextPlaylistById = new Map();

        return {
            albums: snapshotAlbums,
            tracks: nextTracks,
            artists: nextArtists,
            playlists: nextPlaylists,
            albumByTitle: nextAlbumByTitle,
            trackByKey: nextTrackByKey,
            artistByKey: nextArtistByKey,
            playlistById: nextPlaylistById
        };
    }

    function commitLibrarySnapshot(snapshot) {
        LIBRARY_ALBUMS = snapshot.albums;
        LIBRARY_TRACKS = snapshot.tracks;
        LIBRARY_ARTISTS = snapshot.artists;
        LIBRARY_PLAYLISTS = snapshot.playlists;
        albumByTitle.clear();
        snapshot.albumByTitle.forEach((value, key) => albumByTitle.set(key, value));
        trackByKey.clear();
        snapshot.trackByKey.forEach((value, key) => trackByKey.set(key, value));
        artistByKey.clear();
        snapshot.artistByKey.forEach((value, key) => artistByKey.set(key, value));
        playlistById.clear();
        snapshot.playlistById.forEach((value, key) => playlistById.set(key, value));
        rebuildSearchData();
        libraryStructureSignature = snapshotStructuralSignature(snapshot.albums);
    }

    function installLibrarySnapshot(albums, options = {}) {
        const {
            scanOperation = null,
            resetPlayback = false,
            renderHome = false,
            renderLibrary = false,
            syncEmpty = false,
            updateHealth = false,
            force = false
        } = options;
        const changed = force || isLibrarySnapshotStructurallyDifferent(albums);
        const snapshot = buildLibrarySnapshotIndexes(albums);
        commitLibrarySnapshot(snapshot);
        updateLibrarySnapshotArtworkOwnership(snapshot.albums, scanOperation);
        if (changed) setLibraryRenderDirty(true);
        if (resetPlayback) resetPlaybackState();
        if (renderHome) renderHomeSections();
        if (renderLibrary) renderLibraryViews();
        if (syncEmpty) syncEmptyState();
        if (updateHealth) updatePlaybackHealthWarnings();
        return changed;
    }

    async function mergeScannedIntoLibrary() {
        if (fileHandleCache.size === 0 && scannedFiles.length === 0) return;
        const scanOperation = beginLibraryScanOperation();
        try {
        if (DEBUG) console.log('[Auralis] mergeScannedIntoLibrary (two-pass): scannedFiles=' + scannedFiles.length + ', fileHandleCache=' + fileHandleCache.size + ', artHandleCache=' + artHandleCache.size);

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

        // ── PASS 1: Build placeholder albums from filenames only (no file I/O) ──
        const newAlbums = [];
        let trackIdx = 0;
        for (const [groupKey, group] of albumMap) {
            const sorted = group.files.slice().sort((a, b) =>
                a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
            );
            const parentGuess = String(group.parentFolderName || '').trim();
            const artistGuess = isLikelyPlaceholderArtist(parentGuess)
                ? group.albumName
                : (parentGuess || group.albumName);
            const tracks = [];
            for (let idx = 0; idx < sorted.length; idx++) {
                const file = sorted[idx];
                const parsed = parseTrackFilename(file.name);
                const ext = file.name.split('.').pop().toLowerCase();
                const handleKey = getScannedFileHandleKey(file) || file.name.toLowerCase();
                trackIdx++;
                tracks.push({
                    no:             parsed.no || (idx + 1),
                    title:          parsed.title,
                    artist:         parsed.parsedArtist || artistGuess,
                    albumTitle:     group.albumName,
                    year:           '',
                    genre:          '',
                    duration:       '--:--',
                    durationSec:    0,
                    ext,
                    artUrl:         '',
                    fileUrl:        '',
                    path:           '',
                    plays:          100 + trackIdx,
                    addedRank:      1000 + trackIdx,
                    lastPlayedDays: 1,
                    _scanned:       true,
                    _handleKey:     handleKey,
                    _metaDone:      false
                });
            }
            if (tracks.length === 0) continue;
            newAlbums.push({
                id:                '_scanned_' + groupKey,
                title:             group.albumName,
                artist:            artistGuess,
                year:              '',
                genre:             '',
                artUrl:            '',
                trackCount:        tracks.length,
                totalDurationLabel: toLibraryDurationTotal(tracks),
                tracks,
                _artKey:           group.artKey,
                _scanned:          true,
                _metaDone:         false
            });
        }

        if (newAlbums.length === 0) return;

        // Resolve sidecar album art (cover.jpg / folder.png) quickly
        const sidecarBlobCache = new Map();
        for (const album of newAlbums) {
            ensureLibraryScanActive(scanOperation);
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
                    scanOperation.createdBlobUrls.add(artBlobUrl);
                }
                album.artUrl = artBlobUrl;
                album.tracks.forEach(t => { if (!t.artUrl) t.artUrl = artBlobUrl; });
                if (album._artKey) sidecarBlobCache.set(album._artKey, artBlobUrl);
                if (DEBUG) console.log('[Auralis]   Sidecar art for "' + album.title + '"');
            } catch (e) {
                console.warn('[Auralis]   Could not load sidecar art for "' + album.title + '":', e);
            }
        }

        // Install placeholder library and render UI immediately
        installLibrarySnapshot(newAlbums, {
            scanOperation,
            resetPlayback: true,
            renderHome: true,
            renderLibrary: true,
            syncEmpty: true,
            updateHealth: true,
            force: true
        });
        if (DEBUG) console.log('[Auralis] Pass 1 complete: ' + LIBRARY_ALBUMS.length + ' albums, ' + LIBRARY_TRACKS.length + ' tracks (placeholder)');

        // -- PASS 2: Background metadata + art extraction --
        const allTracks = newAlbums.flatMap(a => a.tracks);
        await backgroundMetadataPass(allTracks, newAlbums, scanOperation);

        } catch (err) {
            if (!err || err.message !== '__AURALIS_SCAN_CANCELED__') throw err;
        } finally {
            if (scanOperation.canceled) revokeUrlSet(scanOperation.createdBlobUrls);
            finishLibraryScanOperation(scanOperation);
        }
    }

    // -- Library index rebuilder (shared by pass 1 and pass 2) --

    function rebuildLibraryIndexes() {
        commitLibrarySnapshot(buildLibrarySnapshotIndexes(LIBRARY_ALBUMS));
    }

    // Majority-vote helper: most frequent non-empty string
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

    // -- Background metadata pass --
    // Reads embedded tags + art one track at a time in non-blocking batches.
    // After processing, updates album models and re-renders the UI so artwork
    // appears progressively. Persists extracted art into IndexedDB.

    async function backgroundMetadataPass(allTracks, albums, scanOperation) {
        const BATCH_SIZE = 3;
        const COMMIT_TRACK_COUNT = 12;
        const COMMIT_MAX_MS = 250;
        const YIELD_MS = 0;

        let artCacheBlobs = new Map();
        try { artCacheBlobs = await loadArtCacheIndex(); } catch (_) {}

        const albumForTrack = new Map();
        for (const album of albums) {
            for (const track of album.tracks) {
                albumForTrack.set(track, album);
            }
        }

        let processed = 0;
        let artUpdated = false;
        let processedSinceCommit = 0;
        let lastAlbumCommitKey = '';
        const pendingTrackKeys = new Set();

        const commitMetadataCheckpoint = () => {
            ensureLibraryScanActive(scanOperation);
            if (!pendingTrackKeys.size && !isLibrarySnapshotStructurallyDifferent(LIBRARY_ALBUMS)) return;
            updateLibrarySnapshotArtworkOwnership(LIBRARY_ALBUMS, scanOperation);
            const structuralChanged = isLibrarySnapshotStructurallyDifferent(LIBRARY_ALBUMS);
            if (structuralChanged) {
                installLibrarySnapshot(LIBRARY_ALBUMS, {
                    scanOperation,
                    renderHome: true,
                    renderLibrary: true,
                    syncEmpty: true,
                    updateHealth: true
                });
            } else {
                pendingTrackKeys.forEach((payload) => {
                    APP_STATE.emit('library:metadata-refined', JSON.parse(payload));
                });
            }
            pendingTrackKeys.clear();
            processedSinceCommit = 0;
            scanOperation.lastCommitAt = Date.now();
        };

        for (let i = 0; i < allTracks.length; i += BATCH_SIZE) {
            const batch = allTracks.slice(i, i + BATCH_SIZE);

            for (const track of batch) {
                ensureLibraryScanActive(scanOperation);
                if (track._metaDone) continue;
                const handleKey = track._handleKey;
                if (!handleKey) { track._metaDone = true; continue; }
                const handle = fileHandleCache.get(handleKey) || fileHandleCache.get(track.title?.toLowerCase());
                if (!handle || typeof handle.getFile !== 'function') { track._metaDone = true; continue; }

                try {
                    const previousTrackKey = trackKey(track.title, track.artist);
                    const fileObj = await handle.getFile();
                    if (!fileObj) { track._metaDone = true; continue; }
                    const meta = await readEmbeddedMetadata(fileObj);

                    if (meta.title)   track.title      = meta.title;
                    if (meta.artist)  track.artist      = meta.artist;
                    if (meta.album)   track.albumTitle   = meta.album;
                    if (meta.year)    track.year         = meta.year;
                    if (meta.genre)   track.genre        = meta.genre;
                    if (meta.trackNo) track.no           = meta.trackNo;
                    if (meta.albumArtist) track.albumArtist = meta.albumArtist;
                    if (track.albumArtist && (!meta.artist || isLikelyPlaceholderArtist(track.artist))) {
                        track.artist = track.albumArtist;
                    }
                    if (meta.discNo)  track.discNo       = meta.discNo;
                    if (meta.lyrics)  track.lyrics       = meta.lyrics;
                    if (Number.isFinite(meta.replayGainTrack)) track.replayGainTrack = meta.replayGainTrack;
                    if (Number.isFinite(meta.replayGainAlbum)) track.replayGainAlbum = meta.replayGainAlbum;

                    if (meta.artBlobUrl) {
                        track.artUrl = meta.artBlobUrl;
                        if (/^blob:/i.test(meta.artBlobUrl)) scanOperation.createdBlobUrls.add(meta.artBlobUrl);
                    } else if (!track.artUrl) {
                        const cacheKey = artCacheKey(track.artist, track.albumTitle);
                        const cachedBlob = artCacheBlobs.get(cacheKey);
                        if (cachedBlob) {
                            track.artUrl = URL.createObjectURL(cachedBlob);
                            scanOperation.createdBlobUrls.add(track.artUrl);
                        }
                    }

                    track._metaDone = true;
                    processed++;
                    processedSinceCommit++;
                    pendingTrackKeys.add(JSON.stringify({
                        trackKey: trackKey(track.title, track.artist),
                        previousTrackKey,
                        albumKey: albumKey(track.albumTitle)
                    }));

                    const album = albumForTrack.get(track);
                    if (album && !album.artUrl && track.artUrl) {
                        album.artUrl = track.artUrl;
                        album.tracks.forEach(t => { if (!t.artUrl) t.artUrl = track.artUrl; });
                        artUpdated = true;
                        try {
                            const resp = await fetch(track.artUrl);
                            const blob = await resp.blob();
                            putCachedArt(album.artist, album.title, blob);
                        } catch (_) {}
                    }

                    const currentAlbumCommitKey = albumKey(album?.title || track.albumTitle);
                    const albumBoundary = Boolean(lastAlbumCommitKey && currentAlbumCommitKey !== lastAlbumCommitKey);
                    lastAlbumCommitKey = currentAlbumCommitKey;
                    const timeBudgetExceeded = Date.now() - scanOperation.lastCommitAt >= COMMIT_MAX_MS;
                    if (albumBoundary || processedSinceCommit >= COMMIT_TRACK_COUNT || timeBudgetExceeded) {
                        commitMetadataCheckpoint();
                    }
                } catch (e) {
                    if (DEBUG) console.warn('[Auralis] Background meta failed for', track._handleKey, e);
                    track._metaDone = true;
                }
            }

            await new Promise(r => setTimeout(r, YIELD_MS));
        }

        // Regroup albums by embedded tags
        ensureLibraryScanActive(scanOperation);
        regroupAlbumsByTag(albums);

        if (DEBUG) console.log('[Auralis] Pass 2 complete: processed ' + processed + ' tracks, artUpdated=' + artUpdated);
        commitMetadataCheckpoint();

        // Persist library model to localStorage for instant next-boot
        saveLibraryCache();

        probeDurationsInBackground(allTracks);
    }

    // ── Library Model Cache ─────────────────────────────────────────
    function saveLibraryCache() {
        try {
            const stripped = LIBRARY_ALBUMS.filter(a => a._scanned).map(a => ({
                id: a.id, title: a.title, artist: a.artist, year: a.year, genre: a.genre,
                trackCount: a.trackCount, totalDurationLabel: a.totalDurationLabel,
                tracks: a.tracks.map(t => ({
                    no: t.no, title: t.title, artist: t.artist, albumTitle: t.albumTitle,
                    year: t.year, genre: t.genre, duration: t.duration, durationSec: t.durationSec,
                    ext: t.ext, discNo: t.discNo || 0, albumArtist: t.albumArtist || '',
                    _handleKey: t._handleKey || '', _scanned: true, _metaDone: true
                }))
            }));
            safeStorage.setJson(STORAGE_KEYS.libraryCache, stripped);
        } catch (_) {}
    }

    function loadLibraryCache() {
        try {
            const cached = safeStorage.getJson(STORAGE_KEYS.libraryCache, null);
            if (!Array.isArray(cached) || cached.length === 0) return false;
            for (const a of cached) {
                a._scanned = true;
                a._metaDone = true;
                if (a.tracks) a.tracks.forEach(t => { t._scanned = true; t._metaDone = true; t.artUrl = ''; });
                a.artUrl = '';
            }
            installLibrarySnapshot(cached, { force: true });
            return true;
        } catch (_) { return false; }
    }

    function regroupAlbumsByTag(albums) {
        for (let ai = albums.length - 1; ai >= 0; ai--) {
            const album = albums[ai];
            const tagGroups = new Map();
            for (const track of album.tracks) {
                const tag = (track.albumTitle || album.title).trim().toLowerCase();
                if (!tagGroups.has(tag)) tagGroups.set(tag, []);
                tagGroups.get(tag).push(track);
            }
            if (tagGroups.size <= 1) {
                album.title  = majorityVote(album.tracks.map(t => t.albumTitle)) || album.title;
                album.artist = majorityVote(album.tracks.map(t => t.albumArtist || t.artist)) || album.artist;
                album.year   = majorityVote(album.tracks.map(t => t.year))   || album.year;
                album.genre  = majorityVote(album.tracks.map(t => t.genre))  || album.genre;
                album.tracks.forEach((track) => {
                    const canonicalArtist = getCanonicalTrackArtistName(track, album.artist);
                    if (canonicalArtist) track.artist = canonicalArtist;
                });
                // Sort by disc then track number
                album.tracks.sort((a, b) => (a.discNo || 1) - (b.discNo || 1) || (a.no || 999) - (b.no || 999));
                album._metaDone = true;
                continue;
            }
            let first = true;
            for (const [, subTracks] of tagGroups) {
                subTracks.sort((a, b) => (a.discNo || 1) - (b.discNo || 1) || (a.no || 999) - (b.no || 999));
                const subArt = subTracks.find(t => t.artUrl)?.artUrl || album.artUrl;
                if (subArt) subTracks.forEach(t => { if (!t.artUrl) t.artUrl = subArt; });
                if (first) {
                    album.tracks     = subTracks;
                    album.title      = majorityVote(subTracks.map(t => t.albumTitle)) || album.title;
                    album.artist     = majorityVote(subTracks.map(t => t.albumArtist || t.artist)) || album.artist;
                    album.year       = majorityVote(subTracks.map(t => t.year))   || album.year;
                    album.genre      = majorityVote(subTracks.map(t => t.genre))  || album.genre;
                    album.tracks.forEach((track) => {
                        const canonicalArtist = getCanonicalTrackArtistName(track, album.artist);
                        if (canonicalArtist) track.artist = canonicalArtist;
                    });
                    album.artUrl     = subArt;
                    album.trackCount = subTracks.length;
                    album._metaDone  = true;
                    first = false;
                } else {
                    const subTitle = majorityVote(subTracks.map(t => t.albumTitle)) || album.title;
                    const subArtist = majorityVote(subTracks.map(t => t.albumArtist || t.artist)) || album.artist;
                    subTracks.forEach((track) => {
                        const canonicalArtist = getCanonicalTrackArtistName(track, subArtist);
                        if (canonicalArtist) track.artist = canonicalArtist;
                    });
                    albums.push({
                        id:                album.id + '__sub' + albums.length,
                        title:             subTitle,
                        artist:            subArtist,
                        year:              majorityVote(subTracks.map(t => t.year))   || '',
                        genre:             majorityVote(subTracks.map(t => t.genre))  || '',
                        artUrl:            subArt,
                        trackCount:        subTracks.length,
                        totalDurationLabel: toLibraryDurationTotal(subTracks),
                        tracks:            subTracks,
                        _artKey:           album._artKey,
                        _scanned:          true,
                        _metaDone:         true
                    });
                }
            }
        }
        LIBRARY_ALBUMS = albums;
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
                if (blobUrlCache.has(handleKey)) {
                    blobUrl = blobUrlCache.get(handleKey);
                } else if (fileHandleCache.has(handleKey)) {
                    const handle = fileHandleCache.get(handleKey);
                    if (handle && handle._blobUrl) {
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

        LIBRARY_ALBUMS.filter(a => a._scanned).forEach(album => {
            album.totalDurationLabel = toLibraryDurationTotal(album.tracks);
        });

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

    // Lazily extract embedded artwork from the first available track handle when an
    // album card or song row renders with no stored art. Updates `item.artUrl` and
    // back-fills sibling track objects so subsequent renders are instant.
    async function lazyLoadArt(item, coverEl) {
        if (item.artUrl) return;
        // Albums: search their tracks for a handle key. Tracks: use their own.
        const handleKey = item._handleKey
            || item.tracks?.find(t => t._handleKey)?._handleKey;
        if (!handleKey) return;
        const handle = fileHandleCache.get(handleKey);
        if (!handle || typeof handle.getFile !== 'function') return;
        try {
            const file = await handle.getFile();
            if (!file) return;
            const meta = await readEmbeddedMetadata(file);
            if (!meta.artBlobUrl) return;
            item.artUrl = meta.artBlobUrl;
            // Back-fill sibling tracks so the album detail view also benefits
            if (item.tracks) item.tracks.forEach(t => { if (!t.artUrl) t.artUrl = meta.artBlobUrl; });
            applyArtBackground(coverEl, meta.artBlobUrl, FALLBACK_GRADIENT);
        } catch (_) {}
    }

    function getNowPlayingArtUrl(meta = nowPlaying) {
        if (!meta) return '';
        const direct = resolveArtUrlForContext(meta.artUrl || '');
        if (direct) return direct;

        const hintedAlbum = meta.albumTitle || '';
        if (hintedAlbum) {
            const albumMeta = resolveAlbumMeta(hintedAlbum, meta.artist);
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
