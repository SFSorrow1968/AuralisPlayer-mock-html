    let activeLibraryScanOperation = null;
    let nextLibraryScanOperationId = 0;

    function snapshotStructuralSignature(albums) {
        return JSON.stringify((Array.isArray(albums) ? albums : []).map((album) => ({
            albumKey: getAlbumIdentityKey(album),
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

    function sortAlbumTracks(tracks = []) {
        return tracks.slice().sort((a, b) =>
            Number(a?.discNo || 1) - Number(b?.discNo || 1)
            || Number(a?.no || 0) - Number(b?.no || 0)
            || String(a?.title || '').localeCompare(String(b?.title || ''), undefined, { sensitivity: 'base' })
        );
    }

    function getAlbumTrackIdentity(track) {
        if (track?._handleKey) return `handle:${track._handleKey}`;
        if (track?.path) return `path:${track.path}`;
        return `meta:${track?.discNo || 1}:${track?.no || 0}:${trackKey(track?.title, track?.artist)}`;
    }

    function mergeAlbumTracks(baseTracks = [], incomingTracks = []) {
        const merged = new Map();
        [...baseTracks, ...incomingTracks].forEach((track) => {
            if (!track) return;
            const key = getAlbumTrackIdentity(track);
            const existing = merged.get(key);
            if (!existing) {
                merged.set(key, track);
                return;
            }
            if (!existing.artUrl && track.artUrl) existing.artUrl = track.artUrl;
            if (!existing.durationSec && track.durationSec) existing.durationSec = track.durationSec;
            if ((!existing.duration || existing.duration === '--:--') && track.duration) existing.duration = track.duration;
            if (!existing.albumArtist && track.albumArtist) existing.albumArtist = track.albumArtist;
            if (!existing.year && track.year) existing.year = track.year;
            if (!existing.genre && track.genre) existing.genre = track.genre;
        });
        return sortAlbumTracks(Array.from(merged.values()));
    }

    function splitAlbumsBySourceIdentity(albums = []) {
        const result = [];
        (Array.isArray(albums) ? albums : []).forEach((album) => {
            const tracks = Array.isArray(album?.tracks) ? album.tracks : [];
            if (!album || !tracks.length || !album._scanned) {
                if (album) result.push(album);
                return;
            }
            const groups = new Map();
            tracks.forEach((track) => {
                const sourceId = getTrackSourceAlbumIdentity(track, album) || getAlbumSourceIdentity(album) || album.id || '';
                if (!groups.has(sourceId)) {
                    groups.set(sourceId, {
                        sourceId,
                        sourceTitle: getTrackSourceAlbumTitle(track, album._sourceAlbumTitle || album.title),
                        tracks: []
                    });
                }
                groups.get(sourceId).tracks.push(track);
            });
            if (groups.size <= 1) {
                const sourceId = getAlbumSourceIdentity(album) || groups.keys().next().value || album.id || '';
                const sourceTitle = album._sourceAlbumTitle || groups.values().next().value?.sourceTitle || album.title;
                album._sourceAlbumId = sourceId;
                album._sourceAlbumTitle = sourceTitle;
                tracks.forEach((track) => {
                    track._sourceAlbumId = sourceId;
                    track._sourceAlbumTitle = sourceTitle;
                });
                result.push(album);
                return;
            }
            groups.forEach((group, index) => {
                const sourceTitle = group.sourceTitle || album.title;
                const clone = {
                    ...album,
                    id: group.sourceId || `${album.id || 'album'}__source${index}`,
                    _sourceAlbumId: group.sourceId || `${album.id || 'album'}__source${index}`,
                    _sourceAlbumTitle: sourceTitle,
                    title: isGenericAlbumSourceTitle(sourceTitle) ? album.title : sourceTitle,
                    tracks: group.tracks
                };
                clone.tracks.forEach((track) => {
                    track._sourceAlbumId = clone._sourceAlbumId;
                    track._sourceAlbumTitle = clone._sourceAlbumTitle;
                    if (!isGenericAlbumSourceTitle(clone._sourceAlbumTitle)) track.albumTitle = clone._sourceAlbumTitle;
                });
                clone.trackCount = clone.tracks.length;
                clone.totalDurationLabel = toLibraryDurationTotal(clone.tracks);
                result.push(clone);
            });
        });
        return result;
    }

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
        if (renderLibrary) renderLibraryViews({ force: true });
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
