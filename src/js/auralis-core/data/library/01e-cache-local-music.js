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
