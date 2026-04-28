/*
 * Auralis JS shard: 01b-library-merge-snapshot.js
 * Purpose: album identity merge, snapshot indexes, library snapshot commit/install
 * Generated from auralis-core.js. Edit this file, then run scripts/build-core.ps1.
 */

    function mergeAlbumsByIdentity(albums = []) {
        const mergedAlbums = new Map();
        splitAlbumsBySourceIdentity(albums).forEach((album) => {
            // Retroactively repair placeholder album.artist / album.title that may be
            // stale from the IDB cache (pre-fix scans) or from untagged root-level files.

            // 1. Fix album.artist from majority of non-placeholder track artists.
            if (isLikelyPlaceholderArtist(album.artist) && Array.isArray(album.tracks) && album.tracks.length) {
                const realArtists = album.tracks.map(t => String(t.artist || '').trim()).filter(a => a && !isLikelyPlaceholderArtist(a));
                if (realArtists.length) {
                    album.artist = majorityVote(realArtists) || album.artist;
                }
            }

            // 2. Fix album.title from majority of valid track albumTitles.
            // Only update when we actually find real non-placeholder titles from the tracks.
            // Never overwrite track.albumTitle with 'Unknown Album' — that corrupts the
            // data before pass-2 can set the real value from embedded tags.
            const albumTitleIsBad = !album.title || album.title === 'Unknown Album' || isLikelyPlaceholderArtist(album.title);
            if (albumTitleIsBad && Array.isArray(album.tracks) && album.tracks.length) {
                const sourceTitleHint = String(album._sourceAlbumTitle || '').trim();
                if (sourceTitleHint && !isGenericAlbumSourceTitle(sourceTitleHint)) {
                    album.title = sourceTitleHint;
                    album.tracks.forEach((t) => {
                        if (!t._embeddedAlbumTitle) t.albumTitle = sourceTitleHint;
                    });
                }
                const realTitles = album.tracks.map(t => String(t.albumTitle || '').trim())
                    .filter(v => v && v !== 'Unknown Album' && !isLikelyPlaceholderArtist(v));
                const resolved = majorityVote(realTitles);
                if (resolved) {
                    album.title = resolved;
                    album.tracks.forEach(t => { t.albumTitle = resolved; });
                }
                // If no real title found, leave album.title and track.albumTitle as-is —
                // pass-2 embedded tag reading will overwrite them with real values.
            }

            if (album.title && album.title !== 'Unknown Album' && Array.isArray(album.tracks)) {
                album.tracks.forEach((t) => {
                    if ((!t.albumTitle || t.albumTitle === 'Unknown Album') && !t._embeddedAlbumTitle) {
                        t.albumTitle = album.title;
                    }
                });
            }

            const hintedArtist = inferArtistFromAlbumHints(album);
            const albumArtistLooksBad = isLikelyPlaceholderArtist(album.artist)
                || isSuspiciousAlbumMirrorArtist(album.artist, album.title);
            if (hintedArtist && albumArtistLooksBad) {
                album.artist = hintedArtist;
            }

            // 2b. Repair album.year from track years if the album has no year yet.
            if (!album.year && Array.isArray(album.tracks) && album.tracks.length) {
                const years = album.tracks.map(t => String(t.year || '').trim()).filter(y => y);
                const resolvedYear = majorityVote(years);
                if (resolvedYear) album.year = resolvedYear;
            }

            // 3. Propagate resolved album.artist to tracks whose artist is still a
            //    placeholder (e.g. inherited "Music" from the root folder name).
            if (!isLikelyPlaceholderArtist(album.artist) && Array.isArray(album.tracks)) {
                album.tracks.forEach(t => {
                    const trackArtistLooksBad = isLikelyPlaceholderArtist(t.artist)
                        || isSuspiciousAlbumMirrorArtist(t.artist, t.albumTitle || album.title);
                    if (trackArtistLooksBad) t.artist = album.artist;
                });
            }

            album.tracks = sortAlbumTracks(Array.isArray(album.tracks) ? album.tracks : []);
            album.trackCount = album.tracks.length;
            album.totalDurationLabel = toLibraryDurationTotal(album.tracks);
            if (album.tracks.length && typeof finaliseAlbumArtist === 'function') {
                finaliseAlbumArtist(album, album.tracks);
            }

            const identityKey = getAlbumMergeIdentityKey(album, album.artist);
            const existingAlbum = mergedAlbums.get(identityKey);
            if (!existingAlbum) {
                mergedAlbums.set(identityKey, album);
                return;
            }

            existingAlbum.tracks = mergeAlbumTracks(existingAlbum.tracks, album.tracks);
            existingAlbum.trackCount = existingAlbum.tracks.length;
            existingAlbum.totalDurationLabel = toLibraryDurationTotal(existingAlbum.tracks);
            if (!existingAlbum.artUrl && album.artUrl) existingAlbum.artUrl = album.artUrl;
            if (!existingAlbum.year && album.year) existingAlbum.year = album.year;
            if (!existingAlbum.genre && album.genre) existingAlbum.genre = album.genre;
            if (isLikelyPlaceholderArtist(existingAlbum.artist) && !isLikelyPlaceholderArtist(album.artist)) {
                existingAlbum.artist = album.artist;
            }
            if ((!existingAlbum.albumArtist || isLikelyPlaceholderArtist(existingAlbum.albumArtist)) && album.albumArtist) {
                existingAlbum.albumArtist = album.albumArtist;
            }
            if (existingAlbum.tracks.length && typeof finaliseAlbumArtist === 'function') {
                finaliseAlbumArtist(existingAlbum, existingAlbum.tracks);
            }
        });
        return Array.from(mergedAlbums.values());
    }

    function buildLibrarySnapshotIndexes(albums = LIBRARY_ALBUMS) {
        const snapshotAlbums = mergeAlbumsByIdentity(albums);
        const nextAlbumByTitle = new Map();
        const nextAlbumByIdentity = new Map();
        const nextAlbumBySourceId = new Map();
        const nextTrackByKey = new Map();
        const nextTrackByStableId = new Map();
        const nextTrackLegacyKeyCounts = new Map();
        const nextTracks = [];

        snapshotAlbums.forEach((album) => {
            const titleKey = albumKey(album.title);
            if (titleKey && !nextAlbumByTitle.has(titleKey)) nextAlbumByTitle.set(titleKey, album);
            if (!nextAlbumByIdentity.has(getAlbumIdentityKey(album, album.artist))) {
                nextAlbumByIdentity.set(getAlbumIdentityKey(album, album.artist), album);
            }
            const sourceId = getAlbumSourceIdentity(album);
            if (sourceId) nextAlbumBySourceId.set(sourceId, album);
            album.tracks = sortAlbumTracks(Array.isArray(album.tracks) ? album.tracks : []);
            album.trackCount = album.tracks.length;
            album.totalDurationLabel = toLibraryDurationTotal(album.tracks);

            (Array.isArray(album.tracks) ? album.tracks : []).forEach((track) => {
                // Apply user metadata overrides before indexing
                if (typeof applyMetadataOverride === 'function') applyMetadataOverride(track);
                track._trackId = getStableTrackIdentity(track);
                nextTracks.push(track);
                const key = trackKey(track.title, track.artist);
                nextTrackLegacyKeyCounts.set(key, Number(nextTrackLegacyKeyCounts.get(key) || 0) + 1);
                if (!nextTrackByKey.has(key)) nextTrackByKey.set(key, track);
                if (track._trackId && !nextTrackByStableId.has(track._trackId)) nextTrackByStableId.set(track._trackId, track);
            });
        });

        // Build artist index keyed by track.artist — each track contributes to
        // its own artist profile. albumArtist / compilation flags are intentionally
        // ignored here so that tracks never accumulate under "Various Artists" or
        // a folder-derived placeholder like "Music".
        const artistMap = new Map();
        snapshotAlbums.forEach((album) => {
            (Array.isArray(album.tracks) ? album.tracks : []).forEach((track) => {
                const artistName = String(track.artist || '').trim() || album.artist || ARTIST_NAME;
                if (isLikelyPlaceholderArtist(artistName)) return;
                const key = toArtistKey(artistName);
                if (!key) return;
                if (!artistMap.has(key)) {
                    artistMap.set(key, {
                        name: artistName,
                        artUrl: '',
                        trackCount: 0,
                        albumSet: new Set(),
                        plays: 0,
                        lastPlayedDays: 999
                    });
                }
                const meta = artistMap.get(key);
                meta.trackCount += 1;
                meta.albumSet.add(track.albumTitle || album.title);
                meta.plays += Number(track.plays || 0);
                meta.lastPlayedDays = Math.min(meta.lastPlayedDays, Number(track.lastPlayedDays || 999));
                if (!meta.artUrl && (track.artUrl || album.artUrl)) meta.artUrl = track.artUrl || album.artUrl;
            });
        });

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
            albumByIdentity: nextAlbumByIdentity,
            albumBySourceId: nextAlbumBySourceId,
            trackByKey: nextTrackByKey,
            trackByStableId: nextTrackByStableId,
            trackLegacyKeyCounts: nextTrackLegacyKeyCounts,
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
        albumByIdentity.clear();
        snapshot.albumByIdentity.forEach((value, key) => albumByIdentity.set(key, value));
        albumBySourceId.clear();
        snapshot.albumBySourceId.forEach((value, key) => albumBySourceId.set(key, value));
        trackByKey.clear();
        snapshot.trackByKey.forEach((value, key) => trackByKey.set(key, value));
        trackByStableId.clear();
        snapshot.trackByStableId.forEach((value, key) => trackByStableId.set(key, value));
        trackLegacyKeyCounts.clear();
        snapshot.trackLegacyKeyCounts.forEach((value, key) => trackLegacyKeyCounts.set(key, value));
        artistByKey.clear();
        snapshot.artistByKey.forEach((value, key) => artistByKey.set(key, value));
        playlistById.clear();
        snapshot.playlistById.forEach((value, key) => playlistById.set(key, value));
        rebuildSearchData();
        libraryStructureSignature = snapshotStructuralSignature(snapshot.albums);
        if (typeof scheduleCanonicalLibraryBackendSync === 'function') {
            scheduleCanonicalLibraryBackendSync('commitLibrarySnapshot');
        }
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
        else if (reconcilePlaybackStateWithLibrary()) renderQueue();
        if (renderHome) renderHomeSections();
        if (renderLibrary) renderLibraryViews();
        if (syncEmpty) syncEmptyState();
        if (updateHealth) updatePlaybackHealthWarnings();
        // If the user is currently viewing an album detail screen, refresh it so
        // structural changes (e.g. regroupAlbumsByTag splitting tracks) are visible
        // without requiring a manual navigation away and back.
        if (changed && activeId === 'album_detail' && viewedAlbumTitle) {
            const refreshed = resolveAlbumMeta(viewedAlbumTitle, viewedAlbumArtist || '');
            if (refreshed) renderAlbumDetail(refreshed);
        }
        return changed;
    }

    async function mergeScannedIntoLibrary() {
        if (fileHandleCache.size === 0 && scannedFiles.length === 0) return;
        const scanOperation = beginLibraryScanOperation();
        try {
        if (DEBUG) console.log('[Auralis] mergeScannedIntoLibrary (two-pass): scannedFiles=' + scannedFiles.length + ', fileHandleCache=' + fileHandleCache.size + ', artHandleCache=' + artHandleCache.size);
        updateLibraryScanProgress('indexing', {
            processed: 0,
            total: Math.max(scannedFiles.length, fileHandleCache.size),
            percent: 8,
            countText: `${Math.max(scannedFiles.length, fileHandleCache.size)} files queued`
        });

        // Group scanned files by subdirectory (each subfolder = an album)
        const folderMap = new Map();
        for (const folder of mediaFolders) {
            folderMap.set(folder.id, folder);
        }

        const albumMap = new Map(); // folderId + relative subDir → album grouping
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
            const sourceAlbumId = '_scanned_' + groupKey;
            const sourceAlbumTitle = group.albumName;
            const parentGuess = String(group.parentFolderName || '').trim();
            let artistGuess = isLikelyPlaceholderArtist(parentGuess)
                ? group.albumName
                : (parentGuess || group.albumName);
            // When the best guess is still a placeholder (e.g. files at the root of the
            // "Music" folder), default to ARTIST_NAME rather than polluting with the
            // folder name.  Real artist tags from metadata will overwrite this in pass 2.
            if (isLikelyPlaceholderArtist(artistGuess)) artistGuess = ARTIST_NAME;
            const tracks = [];
            for (let idx = 0; idx < sorted.length; idx++) {
                const file = sorted[idx];
                const parsed = parseTrackFilename(file.name);
                const ext = file.name.split('.').pop().toLowerCase();
                const handleKey = getScannedFileHandleKey(file) || file.name.toLowerCase();
                trackIdx++;
                const track = {
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
                    path:           normalizeRelativeDir(file.subDir)
                                        ? normalizeRelativeDir(file.subDir) + '/' + file.name
                                        : file.name,
                    _fileSize:      Number(file.size || 0),
                    _lastModified:  Number(file.lastModified || 0),
                    plays:          100 + trackIdx,
                    addedRank:      1000 + trackIdx,
                    lastPlayedDays: 1,
                    _scanned:       true,
                    _handleKey:     handleKey,
                    _trackId:       `handle:${handleKey}`,
                    _sourceAlbumId: sourceAlbumId,
                    _sourceAlbumTitle: sourceAlbumTitle,
                    _embeddedAlbumTitle: '',
                    _metaDone:      false,
                    _metadataSource: 'filename_guess',
                    _metadataQuality: METADATA_QUALITY.guessed
                };
                hydrateTrackDurationFromCache(track);
                tracks.push(track);
            }
            if (tracks.length === 0) continue;
            newAlbums.push({
                id:                sourceAlbumId,
                title:             group.albumName,
                artist:            artistGuess,
                year:              '',
                genre:             '',
                artUrl:            '',
                trackCount:        tracks.length,
                totalDurationLabel: toLibraryDurationTotal(tracks),
                tracks,
                _sourceAlbumId:    sourceAlbumId,
                _sourceAlbumTitle: group.albumName,
                _parentFolderName: parentGuess,
                _artKey:           group.artKey,
                _scanned:          true,
                _metaDone:         false
            });
        }

        if (newAlbums.length === 0) return;

        // Resolve sidecar album art (cover.jpg / folder.png) quickly
        updateLibraryScanProgress('artwork', {
            processed: 0,
            total: newAlbums.length,
            percent: 32,
            countText: `${newAlbums.length} albums queued`
        });
        const sidecarBlobCache = new Map();
        for (let albumIdx = 0; albumIdx < newAlbums.length; albumIdx++) {
            const album = newAlbums[albumIdx];
            ensureLibraryScanActive(scanOperation);
            updateLibraryScanProgress('artwork', {
                processed: albumIdx + 1,
                total: newAlbums.length,
                percent: 32 + Math.round(((albumIdx + 1) / Math.max(1, newAlbums.length)) * 18)
            });
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
        updateLibraryScanProgress('tags', {
            processed: 0,
            total: allTracks.length,
            percent: 52,
            countText: `${allTracks.length} tracks queued`
        });
        await backgroundMetadataPass(allTracks, newAlbums, scanOperation);

        } catch (err) {
            if (!err || err.message !== '__AURALIS_SCAN_CANCELED__') throw err;
        } finally {
            if (scanOperation.canceled) revokeUrlSet(scanOperation.createdBlobUrls);
            finishLibraryScanOperation(scanOperation);
        }
    }

    // -- Library index rebuilder (shared by pass 1 and pass 2) --

