/*
 * Auralis JS shard: 01-library-scan-metadata.js
 * Purpose: scan-to-library merge, duration probing, artwork, featured albums
 * Generated from auralis-core.js. Edit this file, then run scripts/build-core.ps1.
 */
    // ── Build library entries from scanned files ──

    let localMusicSnapshotLoaded = false;

    function hasLocalMusicSnapshotLibrary() {
        return Boolean(localMusicSnapshotLoaded) || (Array.isArray(LIBRARY_TRACKS) && LIBRARY_TRACKS.some(track =>
            track && track._metadataSource === 'local-music-endpoint'
        ));
    }

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
        document.body.dataset.noTrack = '1';

        document.querySelectorAll('.mini-title').forEach(el => { setNowPlayingMarqueeText(el, 'No track selected'); });
        document.querySelectorAll('.mini-artist').forEach(el => { setNowPlayingMarqueeText(el, 'Add a folder and run Scan Library'); });

        const pt = getEl('player-title') || document.querySelector('.player-titles h1');
        const pa = getEl('player-artist') || document.querySelector('.player-titles p');
        if (pt) setNowPlayingMarqueeText(pt, 'No track selected');
        if (pa) setNowPlayingMarqueeText(pa, 'Add a folder and run Scan Library');
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
        if (typeof syncLyricsPanel === 'function') syncLyricsPanel(null);
    }

    function normalizeSearchText(value) {
        const normalized = String(value ?? '')
            .normalize('NFKD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[’'`]/g, '')
            .replace(/&/g, ' and ')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, ' ')
            .trim();
        return normalized.replace(/\s+/g, ' ');
    }

    function uniqueSearchValues(values) {
        const seen = new Set();
        const out = [];
        values.flat(Infinity).forEach((value) => {
            const text = String(value ?? '').trim();
            if (!text) return;
            const key = normalizeSearchText(text);
            if (!key || seen.has(key)) return;
            seen.add(key);
            out.push(text);
        });
        return out;
    }

    function createSearchIndex(fields) {
        const weightedFields = Object.fromEntries(
            Object.entries(fields).map(([name, values]) => [
                name,
                uniqueSearchValues(Array.isArray(values) ? values : [values]).flatMap((value) => {
                    const normalized = normalizeSearchText(value);
                    const compact = normalized.replace(/\s+/g, '');
                    return compact && compact !== normalized ? [normalized, compact] : [normalized];
                })
            ])
        );
        return {
            fields: weightedFields,
            text: Object.values(weightedFields).flat().join(' ')
        };
    }

    function rebuildSearchData() {
        const featuredAlbums = getFeaturedAlbums();
        const fallbackArtistArt = featuredAlbums[0]?.artUrl || '';
        const totalTracks = LIBRARY_TRACKS.length;
        const totalAlbums = LIBRARY_ALBUMS.length;
        const tracksByArtistKey = new Map();
        const albumsByArtistKey = new Map();

        function addSearchRelation(map, key, value) {
            if (!key || !value) return;
            if (!map.has(key)) map.set(key, []);
            const list = map.get(key);
            if (!list.includes(value)) list.push(value);
        }

        LIBRARY_TRACKS.forEach((track) => {
            [
                getCanonicalTrackArtistName(track),
                track.artist,
                track.albumArtist
            ].forEach((artist) => addSearchRelation(tracksByArtistKey, toArtistKey(artist), track));
        });

        LIBRARY_ALBUMS.forEach((album) => {
            [
                getAlbumPrimaryArtistName(album, album.artist),
                album.artist,
                album.albumArtist
            ].forEach((artist) => addSearchRelation(albumsByArtistKey, toArtistKey(artist), album));
        });

        const songResults = LIBRARY_TRACKS.map((track, i) => {
            const duration = getTrackDurationSeconds(track);
            const entry = {
                title: track.title || 'Unknown Track',
                subtitle: `${track.artist || ARTIST_NAME} - ${duration > 0 ? toDurationLabel(duration) : '--:--'}`,
                artist: track.artist || ARTIST_NAME,
                albumTitle: track.albumTitle || 'Unknown Album',
                year: track.year || '',
                genre: track.genre || '',
                type: 'songs',
                plays: Number(track.plays || 0),
                duration,
                added: Math.max(1, totalTracks - i),
                artUrl: track.artUrl || '',
                action: () => playTrack(track.title, track.artist, track.albumTitle, getStableTrackIdentity(track))
            };
            entry._searchIndex = createSearchIndex({
                title: entry.title,
                artist: [entry.artist, track.albumArtist || ''],
                album: entry.albumTitle,
                genre: entry.genre,
                year: entry.year,
                path: [track.path || '', track.fileName || '', track._handleKey || '']
            });
            return entry;
        });

        const albumResults = LIBRARY_ALBUMS.map((album, i) => {
            const tracks = Array.isArray(album.tracks) ? album.tracks : [];
            const albumArtist = getAlbumPrimaryArtistName(album, album.artist);
            const genreValues = uniqueSearchValues([
                album.genre || '',
                tracks.map((track) => track.genre || '')
            ]);
            const entry = {
                title: album.title || 'Unknown Album',
                subtitle: `${albumArtist || ARTIST_NAME} - ${Number(album.trackCount || tracks.length || 0)} tracks`,
                artist: albumArtist || ARTIST_NAME,
                albumTitle: album.title || 'Unknown Album',
                year: album.year || '',
                tracks: tracks.slice(),
                trackCount: Number(album.trackCount || tracks.length || 0),
                genre: album.genre || genreValues[0] || '',
                type: 'albums',
                plays: tracks.reduce((total, track) => total + Number(track.plays || 0), 0),
                duration: getAlbumTotalDurationSeconds(album),
                added: Math.max(1, totalAlbums - i),
                artUrl: album.artUrl || tracks.find((track) => track.artUrl)?.artUrl || '',
                action: () => navToAlbum(album.title, album.artist, getAlbumSourceIdentity(album))
            };
            entry._searchIndex = createSearchIndex({
                title: entry.title,
                artist: [entry.artist, album.artist || '', album.albumArtist || ''],
                tracks: tracks.map((track) => track.title || ''),
                genre: genreValues,
                year: entry.year,
                path: [album.path || '', album.subDir || '']
            });
            return entry;
        });

        const artistResults = LIBRARY_ARTISTS.map((artist, i) => {
            const artistName = artist.name || ARTIST_NAME;
            const artistKey = toArtistKey(artistName);
            const albums = albumsByArtistKey.get(artistKey) || [];
            const tracks = tracksByArtistKey.get(artistKey) || [];
            const entry = {
                title: artistName,
                subtitle: `Artist - ${Number(artist.albumCount || albums.length || 0)} albums`,
                artist: artistName,
                name: artistName,
                albumCount: Number(artist.albumCount || albums.length || 0),
                trackCount: Number(artist.trackCount || tracks.length || 0),
                type: 'artists',
                plays: Number(artist.plays || tracks.reduce((total, track) => total + Number(track.plays || 0), 0)),
                duration: 0,
                added: Math.max(1, LIBRARY_ARTISTS.length - i),
                artUrl: artist.artUrl || albums.find((album) => album.artUrl)?.artUrl || tracks.find((track) => track.artUrl)?.artUrl || fallbackArtistArt,
                action: () => routeToArtistProfile(artistName)
            };
            entry._searchIndex = createSearchIndex({
                title: entry.title,
                albums: albums.map((album) => album.title || ''),
                tracks: tracks.map((track) => track.title || ''),
                genre: uniqueSearchValues(tracks.map((track) => track.genre || ''))
            });
            return entry;
        });

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
        if (localMusicSnapshotLoaded) {
            renderHomeSections();
            renderLibraryViews({ force: true });
            syncEmptyState();
            updatePlaybackHealthWarnings();
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

    function inferArtistFromAlbumHints(album = {}) {
        const isUsableArtistHint = (value) => {
            const key = toArtistKey(value);
            if (!key) return false;
            return !['unknown artist', 'unknown folder', 'selected folder', 'music', 'songs', 'audio', 'downloads'].includes(key);
        };
        const albumTitleKey = toArtistKey(album.title || album._sourceAlbumTitle || '');
        const parentHint = String(album._parentFolderName || '').trim();
        if (parentHint && isUsableArtistHint(parentHint)) {
            const parentKey = toArtistKey(parentHint);
            if (parentKey && parentKey !== albumTitleKey) return parentHint;
        }

        const sourceTitle = String(album._sourceAlbumTitle || album.title || '').trim();
        if (!sourceTitle) return '';
        const sourcePatterns = [
            /^(.+?)\s+-\s+\[\d{4}\]\s+.+$/,
            /^(.+?)\s+-\s+.+$/
        ];
        for (const pattern of sourcePatterns) {
            const match = sourceTitle.match(pattern);
            const candidate = String(match?.[1] || '').trim();
            if (!candidate || !isUsableArtistHint(candidate)) continue;
            const candidateKey = toArtistKey(candidate);
            if (candidateKey && candidateKey !== albumTitleKey) return candidate;
        }
        return '';
    }

    function isSuspiciousAlbumMirrorArtist(artist, albumTitle) {
        const artistKey = toArtistKey(artist);
        const albumKeyValue = toArtistKey(albumTitle);
        return Boolean(artistKey && albumKeyValue && artistKey === albumKeyValue);
    }

    // -- Post-scan diagnostics --
    // Runs after every full scan and logs to the browser console so album
    // grouping correctness can be verified without a debugger.  Also exposes
    // window._auralisDebug for interactive inspection.
    function runPostScanDiagnostics() {
        try {
            // --- Pass 1: find misplaced (embedded title ≠ album title) ---
            const misplaced = [];
            for (const album of LIBRARY_ALBUMS) {
                for (const track of album.tracks) {
                    if (track._embeddedAlbumTitle
                            && normalizeAlbumComparisonTitle(track._embeddedAlbumTitle)
                               !== normalizeAlbumComparisonTitle(album.title)) {
                        misplaced.push({ album: album.title, track: track.title, embedded: track._embeddedAlbumTitle });
                    }
                }
            }

            // --- Pass 2: find albums with duplicate disc+track combos ---
            const dupeAlbums = [];
            for (const album of LIBRARY_ALBUMS) {
                const seen = new Map();
                for (const t of album.tracks) {
                    const k = (t.discNo || 1) + ':' + (t.no || 0);
                    if (t.no) { // ignore untagged (no=0)
                        seen.set(k, (seen.get(k) || 0) + 1);
                    }
                }
                const dupes = [...seen.entries()].filter(([, n]) => n > 1);
                if (dupes.length) dupeAlbums.push({ title: album.title, dupes });
            }

            console.group('[Auralis] Post-scan album report (' + LIBRARY_ALBUMS.length + ' albums)');
            LIBRARY_ALBUMS.forEach(a => {
                const partial = a.tracks.filter(t => t._metaDone && (!t.title || !t.artist || !t.albumTitle || !t.year)).length;
                const noEmbed = a.tracks.filter(t => t._metaDone && !t._embeddedAlbumTitle).length;
                const flag = partial || noEmbed;
                const method = flag ? 'warn' : 'log';
                const src = a._sourceAlbumId || a._sourceAlbumTitle || '';
                console[method]('  [' + (flag ? '!' : 'ok') + '] ' + a.title + ' (' + a.tracks.length + ' tracks)'
                    + (flag ? ' — partial=' + partial + ' no-embed-album=' + noEmbed : '')
                    + (src ? '  src=' + src : ''));

                // Auto-print track details for flagged albums so the file paths
                // and extensions are visible without manual console commands.
                if (flag) {
                    console.group('    Track details for "' + a.title + '"');
                    a.tracks.forEach(t => {
                        const ext = (t._handleKey || '').split('.').pop().toLowerCase() || t.ext || '?';
                        const path = (t._handleKey || t.title || '(unknown)');
                        const tags = [
                            t.title ? 'T:' + t.title : 'T:—',
                            t.artist ? 'AR:' + t.artist : 'AR:—',
                            t._embeddedAlbumTitle ? 'AL:' + t._embeddedAlbumTitle : 'AL:—',
                            t.year ? 'Y:' + t.year : 'Y:—',
                            t.no ? '#' + t.no : '#—'
                        ].join(' | ');
                        console.log('      [' + ext + '] ' + path + '\n        → ' + tags);
                    });
                    console.groupEnd();
                }
            });

            if (dupeAlbums.length) {
                console.warn('[Auralis] Albums with duplicate track numbers (likely merged from multiple source albums):');
                dupeAlbums.forEach(d => console.warn('    "' + d.title + '" dupes: ' + d.dupes.map(([k, n]) => 'disc:track=' + k + ' ×' + n).join(', ')));
            }

            if (misplaced.length) {
                console.warn('[Auralis] Tracks with embedded album ≠ current album (' + misplaced.length + '):');
                misplaced.forEach(m => console.warn('    "' + m.track + '" in "' + m.album + '" — embedded says "' + m.embedded + '"'));
            } else {
                console.log('[Auralis] TEST PASS: No tracks found with mismatched embedded album titles.');
            }
            console.groupEnd();

            // Expose for runtime inspection from console: window._auralisDebug.albums()
            if (typeof window !== 'undefined') {
                window._auralisDebug = {
                    albums: () => LIBRARY_ALBUMS.map(a => ({
                        title: a.title, tracks: a.tracks.length, artist: a.artist, _sourceAlbumId: a._sourceAlbumId
                    })),
                    tracksIn: (albumTitleFragment) => {
                        const frag = albumTitleFragment.toLowerCase();
                        const found = LIBRARY_ALBUMS.filter(a => a.title.toLowerCase().includes(frag));
                        return found.flatMap(a => a.tracks.map(t => ({
                            no: t.no, discNo: t.discNo, title: t.title, artist: t.artist,
                            albumTitle: t.albumTitle, _embeddedAlbumTitle: t._embeddedAlbumTitle,
                            _handleKey: t._handleKey, ext: (t._handleKey || '').split('.').pop(),
                            _metaDone: t._metaDone, _metadataQuality: t._metadataQuality
                        })));
                    },
                    misplaced: () => misplaced,
                    dupeTrackNos: () => dupeAlbums
                };
                console.log('[Auralis] Debug helpers: window._auralisDebug.albums() | .tracksIn("title") | .misplaced() | .dupeTrackNos()');
            }
        } catch (_) {}
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
                    const hasEmbeddedTags = Boolean(
                        meta.title || meta.artist || meta.album || meta.year || meta.genre
                        || meta.trackNo || meta.albumArtist || meta.discNo
                    );

                    if (meta.title)   track.title      = meta.title;
                    if (meta.artist)  track.artist      = meta.artist;
                    if (meta.album) {
                        track.albumTitle = meta.album;
                        track._embeddedAlbumTitle = meta.album;
                    }
                    if (meta.year)    track.year         = meta.year;
                    if (meta.genre)   track.genre        = meta.genre;
                    if (meta.trackNo) track.no           = meta.trackNo;
                    if (meta.albumArtist) track.albumArtist = meta.albumArtist;
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
                    setTrackMetadataQuality(
                        track,
                        hasEmbeddedTags ? METADATA_QUALITY.embedded : METADATA_QUALITY.guessed,
                        hasEmbeddedTags ? 'embedded_tags' : 'filename_guess'
                    );
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

            updateLibraryScanProgress('tags', {
                processed: Math.min(i + batch.length, allTracks.length),
                total: allTracks.length,
                percent: 52 + Math.round((Math.min(i + batch.length, allTracks.length) / Math.max(1, allTracks.length)) * 28)
            });
            await new Promise(r => setTimeout(r, YIELD_MS));
        }

        // Regroup albums by embedded tags
        ensureLibraryScanActive(scanOperation);
        regroupAlbumsByTag(albums);

        if (DEBUG) console.log('[Auralis] Pass 2 complete: processed ' + processed + ' tracks, artUpdated=' + artUpdated);
        commitMetadataCheckpoint();

        // Persist library model to localStorage for instant next-boot
        saveLibraryCache();

        // ── Post-scan runtime test ──────────────────────────────────
        // Verifies album grouping correctness and surfaces misplaced tracks
        // so console output can confirm whether the fix worked.
        runPostScanDiagnostics();

        probeDurationsInBackground(allTracks);
    }

    // ── Library Model Cache ─────────────────────────────────────────
    const LIBRARY_CACHE_SCHEMA_VERSION = 4;

    function saveLibraryCache() {
        try {
            const stripped = LIBRARY_ALBUMS.filter(a => a._scanned).map(a => ({
                _cacheSchema: LIBRARY_CACHE_SCHEMA_VERSION,
                id: a.id, title: a.title, artist: a.artist, year: a.year, genre: a.genre,
                artUrl: a.artUrl || '',
                trackCount: a.trackCount, totalDurationLabel: a.totalDurationLabel,
                _sourceAlbumId: a._sourceAlbumId || getAlbumSourceIdentity(a),
                _sourceAlbumTitle: a._sourceAlbumTitle || a.title,
                tracks: a.tracks.map(t => ({
                    no: t.no, title: t.title, artist: t.artist, albumTitle: t.albumTitle,
                    year: t.year, genre: t.genre, duration: t.duration, durationSec: t.durationSec,
                    ext: t.ext, discNo: t.discNo || 0, albumArtist: t.albumArtist || '',
                    artUrl: t.artUrl || '', fileUrl: t.fileUrl || '', path: t.path || '',
                    _handleKey: t._handleKey || '', _trackId: getStableTrackIdentity(t),
                    _sourceAlbumId: t._sourceAlbumId || getTrackSourceAlbumIdentity(t, a),
                    _sourceAlbumTitle: t._sourceAlbumTitle || getTrackSourceAlbumTitle(t, a._sourceAlbumTitle || a.title),
                    _embeddedAlbumTitle: t._embeddedAlbumTitle || '',
                    _fileSize: Number(t._fileSize || 0), _lastModified: Number(t._lastModified || 0),
                    _metadataSource: t._metadataSource || '', _metadataQuality: getTrackMetadataQuality(t),
                    _scanned: true, _metaDone: true
                }))
            }));
            safeStorage.setJson(STORAGE_KEYS.libraryCache, {
                schema: LIBRARY_CACHE_SCHEMA_VERSION,
                albums: stripped
            });
        } catch (_) {}
    }

    function loadLibraryCache() {
        try {
            const raw = safeStorage.getJson(STORAGE_KEYS.libraryCache, null);
            const cached = Array.isArray(raw) ? raw : raw?.albums;
            const schema = Array.isArray(raw) ? 0 : Number(raw?.schema || 0);
            if (!Array.isArray(cached) || cached.length === 0) return false;
            if (schema < LIBRARY_CACHE_SCHEMA_VERSION) return false;
            localMusicSnapshotLoaded = cached.some(album =>
                (Array.isArray(album.tracks) ? album.tracks : []).some(track => track._metadataSource === 'local-music-endpoint')
            );
            for (const a of cached) {
                a._scanned = true;
                a._metaDone = true;
                if (a.tracks) a.tracks.forEach(t => {
                    t._scanned = true;
                    t._metaDone = true;
                    t.artUrl = t.artUrl || '';
                    t.fileUrl = t.fileUrl || '';
                    t.path = t.path || '';
                    t._embeddedAlbumTitle = t._embeddedAlbumTitle || '';
                });
                a.artUrl = a.artUrl || '';
            }
            installLibrarySnapshot(cached, {
                force: true,
                renderHome: true,
                renderLibrary: true,
                syncEmpty: true,
                updateHealth: true
            });
            return true;
        } catch (_) { return false; }
    }

    async function loadLocalMusicSnapshotFromServer(options = {}) {
        const force = Boolean(options.force);
        if (!force && LIBRARY_TRACKS && LIBRARY_TRACKS.length > 0) {
            return false;
        }
        const qaLocalMusicDisabled = location.pathname.endsWith('/Auralis_mock_zenith.html') &&
            safeStorage.getItem('auralis_qa_disable_local_music_autoload') === '1';
        if (qaLocalMusicDisabled) {
            return false;
        }
        if (!window.fetch || !/^https?:$/.test(location.protocol)) {
            return false;
        }
        try {
            const response = await fetch('/api/local-music/snapshot', { cache: 'no-store' });
            if (!response.ok) return false;
            const payload = await response.json();
            const albums = payload?.libraryCache?.albums;
            if (!Array.isArray(albums) || albums.length === 0) return false;

            safeStorage.setItem(ONBOARDED_KEY, '1');
            safeStorage.setItem(SETUP_DONE_KEY, '1');
            installLibrarySnapshot(albums, {
                force: true,
                resetPlayback: true,
                renderHome: true,
                renderLibrary: true,
                syncEmpty: true,
                updateHealth: true
            });
            localMusicSnapshotLoaded = true;
            saveLibraryCache();
            return true;
        } catch (error) {
            console.warn('[Auralis] Local Music auto-load failed:', error);
            return false;
        }
    }

    // Derive a stable albumArtist for an album and auto-detect compilations.
    // A compilation is an album where >2 unique track-artist values exist but
    // a single Album Artist tag (or no tag at all) ties them together.
    function finaliseAlbumArtist(album, tracks) {
        const albumArtistTags = tracks.map(t => String(t.albumArtist || '').trim()).filter(Boolean);
        const majorityAlbumArtist = majorityVote(albumArtistTags);
        const uniqueTrackArtistKeys = new Set(
            tracks.map(t => toArtistKey(String(t.artist || '').trim())).filter(Boolean)
        );
        if (majorityAlbumArtist) {
            album.albumArtist = majorityAlbumArtist;
            // Compilation: tagged albumArtist differs from all/most individual artists
            album.isCompilation = uniqueTrackArtistKeys.size > 1;
        } else if (uniqueTrackArtistKeys.size > 2) {
            // Auto-detect: no albumArtist tag but clearly many contributors
            album.albumArtist    = 'Various Artists';
            album.isCompilation  = true;
        } else {
            album.albumArtist   = album.artist || '';
            album.isCompilation = false;
        }
        return album;
    }

    function regroupAlbumsByTag(albums) {
        // Normalize album tag for grouping: strip trailing punctuation so folder names
        // like "What Makes A Man Start Fires_" and embedded tags like
        // "What Makes A Man Start Fires?" collapse to the same group.
        const tagGroupKey = (title) => normalizeAlbumComparisonTitle(title);
        const trustedAlbumTitle = (album, track) => {
            const embeddedTitle = track._embeddedAlbumTitle || track.albumTitle || '';
            if (shouldPreferEmbeddedAlbumTitle(album, embeddedTitle)) return embeddedTitle;
            return album._sourceAlbumTitle || album.title || embeddedTitle;
        };

        for (let ai = albums.length - 1; ai >= 0; ai--) {
            const album = albums[ai];
            album._sourceAlbumId = album._sourceAlbumId || getAlbumSourceIdentity(album);
            album._sourceAlbumTitle = album._sourceAlbumTitle || album.title;
            const tagGroups = new Map();
            for (const track of album.tracks) {
                track._sourceAlbumId = track._sourceAlbumId || album._sourceAlbumId;
                track._sourceAlbumTitle = track._sourceAlbumTitle || album._sourceAlbumTitle;
                const tag = tagGroupKey(trustedAlbumTitle(album, track));
                if (!tagGroups.has(tag)) tagGroups.set(tag, []);
                tagGroups.get(tag).push(track);
            }
            if (tagGroups.size <= 1) {
                const realTitles1 = album.tracks.map(t => trustedAlbumTitle(album, t)).filter(v => v && v !== 'Unknown Album' && !isLikelyPlaceholderArtist(v));
                const origTitle1  = (!album.title || album.title === 'Unknown Album' || isLikelyPlaceholderArtist(album.title)) ? '' : album.title;
                album.title  = majorityVote(realTitles1) || origTitle1 || 'Unknown Album';
                album.artist = majorityVote(album.tracks.map(t => t.artist).filter(a => !isLikelyPlaceholderArtist(a))) || album.artist;
                album.year   = majorityVote(album.tracks.map(t => t.year).filter(y => y))   || album.year;
                album.genre  = majorityVote(album.tracks.map(t => t.genre).filter(g => g))  || album.genre;
                // Sync track.albumTitle to the resolved album title so the mini-player
                // and navigation stay consistent.
                album.tracks.forEach(t => { t.albumTitle = album.title; });
                finaliseAlbumArtist(album, album.tracks);
                // Sort by disc then track number
                album.tracks.sort((a, b) => (a.discNo || 1) - (b.discNo || 1) || (a.no || 999) - (b.no || 999));
                album._metaDone = true;
                continue;
            }
            let first = true;
            for (const [tag, subTracks] of tagGroups) {
                subTracks.sort((a, b) => (a.discNo || 1) - (b.discNo || 1) || (a.no || 999) - (b.no || 999));
                const subArt = subTracks.find(t => t.artUrl)?.artUrl || album.artUrl;
                if (subArt) subTracks.forEach(t => { if (!t.artUrl) t.artUrl = subArt; });
                if (first) {
                    album.tracks     = subTracks;
                    const realTitles2 = subTracks.map(t => trustedAlbumTitle(album, t)).filter(v => v && v !== 'Unknown Album' && !isLikelyPlaceholderArtist(v));
                    const origTitle2  = (!album.title || album.title === 'Unknown Album' || isLikelyPlaceholderArtist(album.title)) ? '' : album.title;
                    album.title      = majorityVote(realTitles2) || origTitle2 || 'Unknown Album';
                    album.artist     = majorityVote(subTracks.map(t => t.artist).filter(a => !isLikelyPlaceholderArtist(a))) || album.artist;
                    album.year       = majorityVote(subTracks.map(t => t.year).filter(y => y))   || album.year;
                    album.genre      = majorityVote(subTracks.map(t => t.genre).filter(g => g))  || album.genre;
                    subTracks.forEach(t => { t.albumTitle = album.title; });
                    finaliseAlbumArtist(album, subTracks);
                    album.artUrl     = subArt;
                    album.trackCount = subTracks.length;
                    album._metaDone  = true;
                    first = false;
                } else {
                    const realTitles3 = subTracks.map(t => trustedAlbumTitle(album, t)).filter(v => v && v !== 'Unknown Album' && !isLikelyPlaceholderArtist(v));
                    const origTitle3  = (!album.title || album.title === 'Unknown Album' || isLikelyPlaceholderArtist(album.title)) ? '' : album.title;
                    const subTitle = majorityVote(realTitles3) || origTitle3 || 'Unknown Album';
                    const subArtist = majorityVote(subTracks.map(t => t.artist).filter(a => !isLikelyPlaceholderArtist(a))) || album.artist;
                    const subSourceId = (album._sourceAlbumId || album.id || 'album') + '::tag::' + tag;

                    // Before creating an orphaned sub-album, check whether an existing album
                    // in the list is the real home for these tracks.  A common case: files
                    // are in the wrong folder (e.g. "My First Bells") but their embedded
                    // TALB tag says "Acoustic Blowout", while the real album folder
                    // "Minutemen - [1985] Acoustic Blowout!" is already in the list.
                    // We match when the sub-title key is a word-boundary suffix of the
                    // candidate's key (length ≥ 8 prevents spurious single-word matches).
                    const subKey = tagGroupKey(subTitle);
                    const subArtKey = toArtistKey(subArtist);
                    let mergeTarget = null;
                    if (subKey && subKey !== 'unknown album') {
                        for (let mi = 0; mi < albums.length; mi++) {
                            if (mi === ai || albums[mi] === album) continue;
                            const cand = albums[mi];
                            const cKey = tagGroupKey(cand.title || '');
                            if (!cKey) continue;
                            // Exact match or sub-title is a word-boundary suffix of candidate key
                            const exactMatch = cKey === subKey;
                            const suffixMatch = subKey.length >= 8 && (
                                cKey.endsWith(' ' + subKey) || cKey.endsWith('-' + subKey)
                            );
                            if (!exactMatch && !suffixMatch) continue;
                            // Artist check: if both sides have a known artist they must match
                            if (subArtKey && !isLikelyPlaceholderArtist(cand.artist || '')) {
                                const cArtKey = toArtistKey(cand.artist || cand.albumArtist || '');
                                if (cArtKey && cArtKey !== subArtKey) continue;
                            }
                            mergeTarget = cand;
                            break;
                        }
                    }

                    if (mergeTarget) {
                        // Absorb the misplaced sub-tracks into the existing album
                        subTracks.forEach(t => {
                            t.albumTitle      = mergeTarget.title;
                            t._sourceAlbumId  = mergeTarget._sourceAlbumId;
                            t._sourceAlbumTitle = mergeTarget._sourceAlbumTitle;
                        });
                        mergeTarget.tracks = mergeAlbumTracks(mergeTarget.tracks, subTracks);
                        mergeTarget.trackCount = mergeTarget.tracks.length;
                        mergeTarget.totalDurationLabel = toLibraryDurationTotal(mergeTarget.tracks);
                        if (!mergeTarget.artUrl && subArt) mergeTarget.artUrl = subArt;
                        finaliseAlbumArtist(mergeTarget, mergeTarget.tracks);
                        if (DEBUG) console.log('[Auralis] regroupAlbumsByTag: merged ' + subTracks.length + ' tracks from "' + album.title + '" into existing "' + mergeTarget.title + '"');
                    } else {
                        subTracks.forEach(t => {
                            t.albumTitle = subTitle;
                            t._sourceAlbumId = subSourceId;
                            t._sourceAlbumTitle = subTitle;
                        });
                        const subAlbum = {
                            id:                album.id + '__sub' + albums.length,
                            title:             subTitle,
                            artist:            subArtist,
                            year:              majorityVote(subTracks.map(t => t.year).filter(y => y))   || '',
                            genre:             majorityVote(subTracks.map(t => t.genre).filter(g => g))  || '',
                            artUrl:            subArt,
                            trackCount:        subTracks.length,
                            totalDurationLabel: toLibraryDurationTotal(subTracks),
                            tracks:            subTracks,
                            _sourceAlbumId:     subSourceId,
                            _sourceAlbumTitle:  subTitle,
                            _artKey:           album._artKey,
                            _scanned:          true,
                            _metaDone:         true
                        };
                        finaliseAlbumArtist(subAlbum, subTracks);
                        albums.push(subAlbum);
                        if (DEBUG) console.log('[Auralis] regroupAlbumsByTag: created sub-album "' + subTitle + '" from "' + album.title + '" (' + subTracks.length + ' tracks)');
                    }
                }
            }
        }

        // ── Second pass: dupe-track-number split ─────────────────────────────
        // When an album ends up with duplicate disc+track numbers, it likely
        // contains physically co-located files from two different albums: some
        // with embedded album tags and some without. Separate the untagged
        // tracks into their own "Unknown Album" group so the user can correct
        // them via the metadata editor rather than having them silently mixed in.
        for (let ai = albums.length - 1; ai >= 0; ai--) {
            const album = albums[ai];
            if (!album || !album._scanned || !Array.isArray(album.tracks) || album.tracks.length < 2) continue;

            // Detect duplicate disc+track number combos
            const seenNums = new Map();
            for (const t of album.tracks) {
                if (!t.no) continue;
                const k = (t.discNo || 1) + ':' + t.no;
                seenNums.set(k, (seenNums.get(k) || 0) + 1);
            }
            if (![...seenNums.values()].some(n => n > 1)) continue; // no dupes

            // Split into tracks that have an embedded album title vs those that don't
            const hasTag = album.tracks.filter(t => t._embeddedAlbumTitle && normalizeAlbumComparisonTitle(t._embeddedAlbumTitle));
            const noTag  = album.tracks.filter(t => !t._embeddedAlbumTitle || !normalizeAlbumComparisonTitle(t._embeddedAlbumTitle));

            if (!hasTag.length || !noTag.length) continue; // must be a clean tagged/untagged split

            // Keep tagged tracks in the main album
            album.tracks     = sortAlbumTracks(hasTag);
            album.trackCount = hasTag.length;
            album.totalDurationLabel = toLibraryDurationTotal(hasTag);
            finaliseAlbumArtist(album, hasTag);

            // Derive a meaningful title for the orphan group
            const orphanArtist = majorityVote(noTag.map(t => t.artist).filter(a => !isLikelyPlaceholderArtist(a))) || album.artist;
            const orphanTitle  = (orphanArtist && !isLikelyPlaceholderArtist(orphanArtist))
                ? orphanArtist + ' \u2014 Unknown Album'
                : 'Unknown Album';
            const orphanSourceId = (album._sourceAlbumId || album.id || 'album') + '::untagged';
            const orphanArt = noTag.find(t => t.artUrl)?.artUrl || '';

            noTag.forEach(t => {
                t.albumTitle          = orphanTitle;
                t._embeddedAlbumTitle = '';
                t._sourceAlbumId      = orphanSourceId;
                t._sourceAlbumTitle   = orphanTitle;
            });

            const orphanAlbum = {
                id:                 album.id + '__untagged',
                title:              orphanTitle,
                artist:             orphanArtist || album.artist,
                year:               '',
                genre:              majorityVote(noTag.map(t => t.genre).filter(g => g)) || '',
                artUrl:             orphanArt,
                trackCount:         noTag.length,
                totalDurationLabel: toLibraryDurationTotal(noTag),
                tracks:             sortAlbumTracks(noTag),
                _sourceAlbumId:      orphanSourceId,
                _sourceAlbumTitle:   orphanTitle,
                _artKey:            album._artKey,
                _scanned:           true,
                _metaDone:          true
            };
            finaliseAlbumArtist(orphanAlbum, noTag);
            albums.push(orphanAlbum);
            if (DEBUG) console.log('[Auralis] regroupAlbumsByTag [dupe-split]: moved ' + noTag.length + ' untagged tracks out of "' + album.title + '" → "' + orphanTitle + '"');
        }

        LIBRARY_ALBUMS = albums;
    }

    // Background duration probing via hidden Audio element
    async function probeDurationsInBackground(tracks, options = {}) {
        if (!tracks || tracks.length === 0) return { changedCount: 0, failedCount: 0, skippedCount: 0 };
        const audio = document.createElement('audio');
        audio.preload = 'metadata';
        let failedCount = 0;
        let changedCount = 0;
        let skippedCount = 0;
        let processedCount = 0;
        updateLibraryScanProgress('durations', {
            processed: 0,
            total: tracks.length,
            percent: 82,
            countText: `${tracks.length} tracks queued`
        });

        for (const track of tracks) {
            processedCount++;
            if (hydrateTrackDurationFromCache(track) > 0) {
                syncTrackDurationElements(track);
                if (processedCount % 8 === 0 || processedCount === tracks.length) {
                    updateLibraryScanProgress('durations', {
                        processed: processedCount,
                        total: tracks.length,
                        percent: 82 + Math.round((processedCount / Math.max(1, tracks.length)) * 16)
                    });
                }
                continue;
            }
            if (!canProbeTrackDuration(track, options)) {
                skippedCount++;
                syncTrackDurationElements(track);
                if (processedCount % 8 === 0 || processedCount === tracks.length) {
                    updateLibraryScanProgress('durations', {
                        processed: processedCount,
                        total: tracks.length,
                        percent: 82 + Math.round((processedCount / Math.max(1, tracks.length)) * 16)
                    });
                }
                continue;
            }
            const handleKey = track._handleKey;
            if (!handleKey) {
                recordDurationProbeFailure(track, 'No file handle available for duration probe');
                syncTrackDurationElements(track);
                failedCount++;
                continue;
            }

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
                    recordDurationProbeFailure(track, 'No cached file source available for duration probe');
                    syncTrackDurationElements(track);
                    failedCount++;
                    continue;
                }

                if (!blobUrl) {
                    recordDurationProbeFailure(track, 'No playable source available for duration probe');
                    syncTrackDurationElements(track);
                    failedCount++;
                    continue;
                }

                await new Promise((resolve) => {
                    let settled = false;
                    let timeoutId = 0;
                    const cleanup = () => {
                        if (settled) return;
                        settled = true;
                        if (timeoutId) clearTimeout(timeoutId);
                        if (createdBlob) URL.revokeObjectURL(blobUrl);
                        audio.removeEventListener('loadedmetadata', onMeta);
                        audio.removeEventListener('error', onErr);
                        audio.src = '';
                        resolve();
                    };
                    const onMeta = () => {
                        if (Number.isFinite(audio.duration) && audio.duration > 0) {
                            if (cacheTrackDuration(track, audio.duration, { persist: false })) {
                                changedCount++;
                                syncTrackDurationElements(track);
                            }
                        } else {
                            failedCount++;
                            recordDurationProbeFailure(track, 'Audio metadata loaded without a valid duration');
                            syncTrackDurationElements(track);
                        }
                        cleanup();
                    };
                    const onErr = () => {
                        failedCount++;
                        recordDurationProbeFailure(track, 'Audio element could not read duration metadata');
                        syncTrackDurationElements(track);
                        cleanup();
                    };
                    audio.addEventListener('loadedmetadata', onMeta, { once: true });
                    audio.addEventListener('error', onErr, { once: true });
                    audio.src = blobUrl;
                    audio.load();
                    timeoutId = setTimeout(() => {
                        failedCount++;
                        recordDurationProbeFailure(track, 'Duration probe timed out');
                        syncTrackDurationElements(track);
                        cleanup();
                    }, 8000);
                });
            } catch (err) {
                failedCount++;
                recordDurationProbeFailure(track, err?.message || 'Duration probe failed');
                syncTrackDurationElements(track);
                continue;
            }
            if (processedCount % 8 === 0 || processedCount === tracks.length) {
                updateLibraryScanProgress('durations', {
                    processed: processedCount,
                    total: tracks.length,
                    percent: 82 + Math.round((processedCount / Math.max(1, tracks.length)) * 16)
                });
            }
        }

        if (failedCount > 0) {
            toast(failedCount + ' track' + (failedCount > 1 ? 's' : '') + ' could not be probed for duration');
        }

        LIBRARY_ALBUMS.filter(a => a._scanned).forEach(album => {
            refreshAlbumTotalDurationLabel(album);
        });
        refreshVisibleAlbumDurationMetadata();
        if (changedCount > 0) {
            persistDurationCache();
            saveLibraryCache();
        }

        renderHomeSections();
        renderLibraryViews();
        updateLibraryScanProgress('complete', {
            processed: tracks.length,
            total: tracks.length,
            percent: 100,
            countText: `${tracks.length} tracks indexed`
        });
        return { changedCount, failedCount, skippedCount };
    }

    function applyArtBackground(el, artUrl, fallback = FALLBACK_GRADIENT) {
        if (!el) return;
        const resolvedUrl = resolveArtUrlForContext(artUrl);
        const fallbackBackground = fallback || getStableArtworkFallback(
            el.dataset?.trackId || el.dataset?.albumKey || el.dataset?.playlistId || el.dataset?.artistKey || el.textContent,
            el.dataset?.trackId ? 'track' : 'collection'
        );
        if (resolvedUrl) {
            el.style.background = '';
            el.style.backgroundImage = `linear-gradient(rgba(0,0,0,.2), rgba(0,0,0,.25)), url("${resolvedUrl}")`;
            el.style.backgroundSize = 'cover';
            el.style.backgroundPosition = 'center';
            el.style.backgroundRepeat = 'no-repeat';
        } else if (fallbackBackground) {
            el.style.backgroundImage = '';
            el.style.background = fallbackBackground;
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

        const keyed = trackByStableId.get(getTrackIdentityKey(meta))
            || trackByKey.get(trackKey(meta.title, meta.artist));
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
            const key = getAlbumIdentityKey(album, album.artist);
            if (seen.has(key)) return;
            seen.add(key);
            featured.push(album);
        });

        return featured;
    }
