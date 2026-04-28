/*
 * Auralis JS shard: 01c-library-artist-diagnostics.js
 * Purpose: library index rebuild, majority vote, artist inference, post-scan diagnostics, cache
 * Generated from auralis-core.js. Edit this file, then run scripts/build-core.ps1.
 */

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
        } catch (_) { /* benign: cleanup */ }
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
        try { artCacheBlobs = await loadArtCacheIndex(); } catch (_) { /* benign: cleanup */ }

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
                        } catch (_) { /* benign: cleanup */ }
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
                trackCount: a.trackCount, totalDurationLabel: a.totalDurationLabel,
                _sourceAlbumId: a._sourceAlbumId || getAlbumSourceIdentity(a),
                _sourceAlbumTitle: a._sourceAlbumTitle || a.title,
                tracks: a.tracks.map(t => ({
                    no: t.no, title: t.title, artist: t.artist, albumTitle: t.albumTitle,
                    year: t.year, genre: t.genre, duration: t.duration, durationSec: t.durationSec,
                    ext: t.ext, discNo: t.discNo || 0, albumArtist: t.albumArtist || '',
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
        } catch (_) { /* benign: cleanup */ }
    }

    function loadLibraryCache() {
        try {
            const raw = safeStorage.getJson(STORAGE_KEYS.libraryCache, null);
            const cached = Array.isArray(raw) ? raw : raw?.albums;
            const schema = Array.isArray(raw) ? 0 : Number(raw?.schema || 0);
            if (!Array.isArray(cached) || cached.length === 0) return false;
            if (schema < LIBRARY_CACHE_SCHEMA_VERSION) return false;
            for (const a of cached) {
                a._scanned = true;
                a._metaDone = true;
                if (a.tracks) a.tracks.forEach(t => {
                    t._scanned = true;
                    t._metaDone = true;
                    t.artUrl = '';
                    t._embeddedAlbumTitle = t._embeddedAlbumTitle || '';
                });
                a.artUrl = '';
            }
            installLibrarySnapshot(cached, { force: true });
            return true;
        } catch (_) { return false; }
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

