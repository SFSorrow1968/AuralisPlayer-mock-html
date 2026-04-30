    function openMediaDB() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(IDB_NAME, IDB_VERSION);
            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(FOLDER_STORE)) {
                    db.createObjectStore(FOLDER_STORE, { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains(FILES_STORE)) {
                    const fs = db.createObjectStore(FILES_STORE, { keyPath: 'id', autoIncrement: true });
                    fs.createIndex('folderId', 'folderId', { unique: false });
                }
                if (!db.objectStoreNames.contains(ART_STORE)) {
                    db.createObjectStore(ART_STORE, { keyPath: 'key' });
                }
                ensureCanonicalBackendStores(db);
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    function ensureCanonicalBackendStores(db) {
        if (!db.objectStoreNames.contains(BACKEND_META_STORE)) {
            db.createObjectStore(BACKEND_META_STORE, { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains(BACKEND_SOURCES_STORE)) {
            db.createObjectStore(BACKEND_SOURCES_STORE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(BACKEND_FILES_STORE)) {
            const store = db.createObjectStore(BACKEND_FILES_STORE, { keyPath: 'id' });
            store.createIndex('sourceId', 'sourceId', { unique: false });
            store.createIndex('relativePath', 'relativePath', { unique: false });
        }
        if (!db.objectStoreNames.contains(BACKEND_RAW_TAGS_STORE)) {
            const store = db.createObjectStore(BACKEND_RAW_TAGS_STORE, { keyPath: 'id' });
            store.createIndex('fileId', 'fileId', { unique: false });
        }
        if (!db.objectStoreNames.contains(BACKEND_ARTISTS_STORE)) {
            const store = db.createObjectStore(BACKEND_ARTISTS_STORE, { keyPath: 'id' });
            store.createIndex('normalizedName', 'normalizedName', { unique: true });
        }
        if (!db.objectStoreNames.contains(BACKEND_TRACKS_STORE)) {
            const store = db.createObjectStore(BACKEND_TRACKS_STORE, { keyPath: 'id' });
            store.createIndex('artistId', 'canonicalArtistId', { unique: false });
            store.createIndex('normalizedTitle', 'normalizedTitle', { unique: false });
        }
        if (!db.objectStoreNames.contains(BACKEND_RELEASES_STORE)) {
            const store = db.createObjectStore(BACKEND_RELEASES_STORE, { keyPath: 'id' });
            store.createIndex('albumArtistId', 'albumArtistId', { unique: false });
            store.createIndex('normalizedTitle', 'normalizedTitle', { unique: false });
        }
        if (!db.objectStoreNames.contains(BACKEND_RELEASE_TRACKS_STORE)) {
            const store = db.createObjectStore(BACKEND_RELEASE_TRACKS_STORE, { keyPath: 'id' });
            store.createIndex('releaseId', 'releaseId', { unique: false });
            store.createIndex('fileId', 'fileId', { unique: false });
        }
        if (!db.objectStoreNames.contains(BACKEND_ARTWORK_STORE)) {
            db.createObjectStore(BACKEND_ARTWORK_STORE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(BACKEND_RELEASE_ARTWORK_STORE)) {
            const store = db.createObjectStore(BACKEND_RELEASE_ARTWORK_STORE, { keyPath: 'id' });
            store.createIndex('releaseId', 'releaseId', { unique: true });
        }
        if (!db.objectStoreNames.contains(BACKEND_SESSIONS_STORE)) {
            db.createObjectStore(BACKEND_SESSIONS_STORE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(BACKEND_QUEUE_STORE)) {
            const store = db.createObjectStore(BACKEND_QUEUE_STORE, { keyPath: 'id' });
            store.createIndex('sessionId', 'sessionId', { unique: false });
            store.createIndex('ordinal', 'ordinal', { unique: false });
        }
    }

    function idbPut(db, storeName, item) {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readwrite');
            tx.objectStore(storeName).put(item);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    function idbDelete(db, storeName, key) {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readwrite');
            tx.objectStore(storeName).delete(key);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    function idbGetAll(db, storeName) {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readonly');
            const req = tx.objectStore(storeName).getAll();
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    function idbClearByIndex(db, storeName, indexName, key) {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            const idx = store.index(indexName);
            const req = idx.openCursor(IDBKeyRange.only(key));
            req.onsuccess = (e) => {
                const cursor = e.target.result;
                if (cursor) { cursor.delete(); cursor.continue(); }
            };
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    function idbClearStore(db, storeName) {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readwrite');
            tx.objectStore(storeName).clear();
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    function idbGet(db, storeName, key) {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readonly');
            const req = tx.objectStore(storeName).get(key);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => reject(req.error);
        });
    }

    function canonicalArtistId(name) {
        const normalized = toArtistKey(name || ARTIST_NAME);
        return normalized ? `artist:${normalized}` : `artist:${toArtistKey(ARTIST_NAME)}`;
    }

    function canonicalTrackId(track, fallbackArtist = '') {
        const stableId = getStableTrackIdentity(track);
        if (stableId) return `track:${stableId}`;
        const artistName = String(track?.artist || fallbackArtist || ARTIST_NAME).trim() || ARTIST_NAME;
        return `track:${trackKey(track?.title || 'unknown-track', artistName)}`;
    }

    function canonicalReleaseId(album) {
        return `release:${getAlbumMergeIdentityKey(album, album?.artist || '')}`;
    }

    function canonicalArtworkId(seed) {
        return `art:${String(seed || '').trim().toLowerCase()}`;
    }

    function canonicalSourceId(folder) {
        return folder?.id ? `source:${folder.id}` : CANONICAL_CACHE_SOURCE_ID;
    }

    function canonicalScannedFileId(file) {
        const handleKey = getHandleCacheKey(file?.folderId, file?.subDir, file?.name);
        if (handleKey) return `file:${handleKey}`;
        const pathKey = normalizeRelativeDir(file?.path || joinRelativeDir(file?.subDir, file?.name)).toLowerCase();
        if (file?.folderId && pathKey) return `file:${String(file.folderId).toLowerCase()}::${pathKey}`;
        return '';
    }

    function toCanonicalReleasePayload(album) {
        return {
            id: String(album?.id || '').trim(),
            schema: LIBRARY_CACHE_SCHEMA_VERSION,
            title: album?.title || 'Unknown Album',
            artist: album?.artist || ARTIST_NAME,
            albumArtist: album?.albumArtist || getAlbumPrimaryArtistName(album, album?.artist || ARTIST_NAME) || ARTIST_NAME,
            year: String(album?.year || '').trim(),
            genre: String(album?.genre || '').trim(),
            artUrl: album?.artUrl || '',
            isCompilation: Boolean(album?.isCompilation),
            _sourceAlbumId: album?._sourceAlbumId || getAlbumSourceIdentity(album),
            _sourceAlbumTitle: album?._sourceAlbumTitle || album?.title || '',
            trackCount: Number(album?.trackCount || (Array.isArray(album?.tracks) ? album.tracks.length : 0) || 0),
            totalDurationLabel: album?.totalDurationLabel || ''
        };
    }

    function toCanonicalReleaseTrackPayload(track, album) {
        return {
            title: track?.title || '',
            artist: track?.artist || album?.artist || ARTIST_NAME,
            albumTitle: track?.albumTitle || album?.title || '',
            albumArtist: track?.albumArtist || album?.albumArtist || '',
            year: String(track?.year || album?.year || '').trim(),
            genre: String(track?.genre || album?.genre || '').trim(),
            no: Number(track?.no || 0),
            discNo: Number(track?.discNo || 1) || 1,
            duration: track?.duration || '',
            durationSec: Number(track?.durationSec || 0),
            artUrl: track?.artUrl || album?.artUrl || '',
            path: track?.path || '',
            plays: Number(track?.plays || 0),
            addedRank: Number(track?.addedRank || 0),
            lastPlayedDays: Number(track?.lastPlayedDays || 0),
            ext: track?.ext || '',
            lyrics: track?.lyrics || '',
            replayGainTrack: Number.isFinite(track?.replayGainTrack) ? Number(track.replayGainTrack) : null,
            replayGainAlbum: Number.isFinite(track?.replayGainAlbum) ? Number(track.replayGainAlbum) : null,
            isFavorite: Boolean(track?.isFavorite),
            _handleKey: track?._handleKey || '',
            _sourceAlbumId: track?._sourceAlbumId || getTrackSourceAlbumIdentity(track, album),
            _sourceAlbumTitle: track?._sourceAlbumTitle || getTrackSourceAlbumTitle(track, album?._sourceAlbumTitle || album?.title || ''),
            _embeddedAlbumTitle: track?._embeddedAlbumTitle || '',
            _metaDone: Boolean(track?._metaDone)
        };
    }

    function parseCanonicalPayloadJson(rawValue, fallback = {}) {
        if (typeof rawValue !== 'string' || !rawValue) return fallback;
        try {
            return JSON.parse(rawValue);
        } catch (_) {
            return fallback;
        }
    }

    function materializeCanonicalLibraryCache(dataset = {}, meta = {}) {
        const artistsById = new Map((Array.isArray(dataset.artists) ? dataset.artists : []).map((row) => [row.id, row]));
        const tracksById = new Map((Array.isArray(dataset.tracks) ? dataset.tracks : []).map((row) => [row.id, row]));
        const rawTagsByFileId = new Map((Array.isArray(dataset.rawTags) ? dataset.rawTags : []).map((row) => [row.fileId, row]));
        const artworkById = new Map((Array.isArray(dataset.artwork) ? dataset.artwork : []).map((row) => [row.id, row]));
        const artworkByReleaseId = new Map();
        (Array.isArray(dataset.releaseArtwork) ? dataset.releaseArtwork : []).forEach((row) => {
            const artwork = artworkById.get(row?.artworkId);
            if (artwork) artworkByReleaseId.set(row.releaseId, artwork);
        });

        const releaseTracksByReleaseId = new Map();
        (Array.isArray(dataset.releaseTracks) ? dataset.releaseTracks : []).forEach((row) => {
            if (!releaseTracksByReleaseId.has(row.releaseId)) releaseTracksByReleaseId.set(row.releaseId, []);
            releaseTracksByReleaseId.get(row.releaseId).push(row);
        });

        const nextAlbums = [];
        const nextByIdentity = new Map();
        const nextByReleaseId = new Map();

        (Array.isArray(dataset.releases) ? dataset.releases : []).forEach((release) => {
            const releasePayload = parseCanonicalPayloadJson(release?.payloadJson, {});
            const releaseArtwork = artworkByReleaseId.get(release?.id);
            const albumArtistName = artistsById.get(release?.albumArtistId)?.name
                || releasePayload.albumArtist
                || releasePayload.artist
                || ARTIST_NAME;
            const album = {
                id: releasePayload.id || release?.sourceGroupKey || release?.id || '',
                title: releasePayload.title || release?.title || 'Unknown Album',
                artist: releasePayload.artist || albumArtistName,
                albumArtist: releasePayload.albumArtist || albumArtistName,
                year: releasePayload.year || String(release?.releaseYear || '').trim(),
                genre: releasePayload.genre || '',
                artUrl: releasePayload.artUrl || releaseArtwork?.storagePath || '',
                isCompilation: Boolean(releasePayload.isCompilation || release?.releaseType === 'compilation'),
                trackCount: Number(releasePayload.trackCount || release?.trackCount || 0),
                totalDurationLabel: releasePayload.totalDurationLabel || release?.totalDurationLabel || '',
                tracks: [],
                _sourceAlbumId: releasePayload._sourceAlbumId || release?.sourceGroupKey || '',
                _sourceAlbumTitle: releasePayload._sourceAlbumTitle || releasePayload.title || release?.title || ''
            };

            const releaseTracks = (releaseTracksByReleaseId.get(release?.id) || []).slice().sort((a, b) =>
                Number(a?.discNumber || 1) - Number(b?.discNumber || 1)
                || Number(a?.trackNumber || 0) - Number(b?.trackNumber || 0)
            );

            album.tracks = releaseTracks.map((releaseTrack, index) => {
                const trackPayload = parseCanonicalPayloadJson(releaseTrack?.payloadJson, {});
                const tagRow = rawTagsByFileId.get(releaseTrack?.fileId);
                const rawPayload = parseCanonicalPayloadJson(tagRow?.payloadJson, {});
                const trackRow = tracksById.get(releaseTrack?.trackId);
                const artistName = artistsById.get(releaseTrack?.displayArtistId)?.name
                    || artistsById.get(trackRow?.canonicalArtistId)?.name
                    || trackPayload.artist
                    || tagRow?.artist
                    || album.artist
                    || ARTIST_NAME;
                const durationSec = Number(trackPayload.durationSec || 0) || Math.round(Number(releaseTrack?.durationMs || tagRow?.durationMs || trackRow?.durationMs || 0) / 1000);
                return {
                    title: trackPayload.title || releaseTrack?.displayTitle || trackRow?.title || tagRow?.title || `Track ${index + 1}`,
                    artist: artistName,
                    albumTitle: trackPayload.albumTitle || tagRow?.album || album.title,
                    albumArtist: trackPayload.albumArtist || tagRow?.albumArtist || album.albumArtist || album.artist,
                    year: trackPayload.year || String(tagRow?.releaseYear || album.year || '').trim(),
                    genre: trackPayload.genre || String(tagRow?.genre || album.genre || '').trim(),
                    no: Number(trackPayload.no || tagRow?.trackNumber || releaseTrack?.trackNumber || index + 1) || (index + 1),
                    discNo: Number(trackPayload.discNo || tagRow?.discNumber || releaseTrack?.discNumber || 1) || 1,
                    duration: trackPayload.duration || toDurationLabel(durationSec),
                    durationSec,
                    artUrl: trackPayload.artUrl || album.artUrl || '',
                    path: trackPayload.path || rawPayload.path || '',
                    plays: Number(trackPayload.plays || 0),
                    addedRank: Number(trackPayload.addedRank || 0),
                    lastPlayedDays: Number(trackPayload.lastPlayedDays || 0),
                    ext: trackPayload.ext || rawPayload.ext || '',
                    lyrics: trackPayload.lyrics || '',
                    replayGainTrack: Number.isFinite(trackPayload.replayGainTrack) ? Number(trackPayload.replayGainTrack) : NaN,
                    replayGainAlbum: Number.isFinite(trackPayload.replayGainAlbum) ? Number(trackPayload.replayGainAlbum) : NaN,
                    isFavorite: Boolean(trackPayload.isFavorite),
                    _handleKey: trackPayload._handleKey || rawPayload.handleKey || '',
                    _sourceAlbumId: trackPayload._sourceAlbumId || album._sourceAlbumId || '',
                    _sourceAlbumTitle: trackPayload._sourceAlbumTitle || album._sourceAlbumTitle || album.title || '',
                    _embeddedAlbumTitle: trackPayload._embeddedAlbumTitle || tagRow?.album || '',
                    _metaDone: trackPayload._metaDone !== undefined ? Boolean(trackPayload._metaDone) : true,
                    _backendReleaseId: release?.id || '',
                    _backendReleaseTrackId: releaseTrack?.id || ''
                };
            });

            album.trackCount = album.tracks.length || album.trackCount;
            album.totalDurationLabel = album.totalDurationLabel || toLibraryDurationTotal(album.tracks);
            if (album.tracks.length && typeof finaliseAlbumArtist === 'function') {
                finaliseAlbumArtist(album, album.tracks);
            }

            nextAlbums.push(album);
            nextByReleaseId.set(release?.id, album);
            nextByIdentity.set(getAlbumIdentityKey(album, album.artist), album);
        });

        canonicalLibraryAlbums = nextAlbums;
        canonicalLibraryAlbumByIdentity.clear();
        nextByIdentity.forEach((value, key) => canonicalLibraryAlbumByIdentity.set(key, value));
        canonicalLibraryAlbumByReleaseId.clear();
        nextByReleaseId.forEach((value, key) => canonicalLibraryAlbumByReleaseId.set(key, value));
        canonicalLibraryCacheLoaded = true;
        canonicalLibraryCacheRevision = Math.max(0, Number(meta?.revision || 0));
        canonicalLibraryCacheUpdatedAt = meta?.updatedAt || '';
        return nextAlbums;
    }

    function getCanonicalBackendAlbumMeta(inputTitle, inputArtist = '') {
        try {
            if (!canonicalLibraryCacheLoaded && !canonicalLibraryAlbums.length) return null;
        } catch (_) {
            return null; // canonical state not yet initialized (called during early IIFE boot)
        }
        if (inputTitle && typeof inputTitle === 'object' && inputTitle._backendReleaseId) {
            const releaseMatch = canonicalLibraryAlbumByReleaseId.get(inputTitle._backendReleaseId);
            if (releaseMatch) return releaseMatch;
        }

        const rawTitle = typeof inputTitle === 'string'
            ? inputTitle
            : (inputTitle && typeof inputTitle === 'object' ? inputTitle.title : '');
        const rawArtist = typeof inputTitle === 'object' && inputTitle
            ? (inputTitle.albumArtist || inputTitle.artist || inputArtist || '')
            : inputArtist;
        const normalizedTitle = normalizeAlbumTitle(rawTitle);
        const normalizedKey = albumKey(normalizedTitle);
        const normalizedArtist = toArtistKey(rawArtist);

        if (normalizedKey && normalizedArtist) {
            const exact = canonicalLibraryAlbumByIdentity.get(albumIdentityKey(normalizedTitle, rawArtist));
            if (exact) return exact;
        }

        if (!normalizedKey) return null;
        return canonicalLibraryAlbums.find((album) => (
            albumKey(album?.title || '') === normalizedKey
            && albumMatchesArtistHint(album, rawArtist)
        )) || null;
    }

    async function hydrateCanonicalLibraryBackendCache(reason = 'cache_read') {
        let db;
        try {
            db = await openMediaDB();
            const [metaRows, artists, tracks, releases, releaseTracks, artwork, releaseArtwork, rawTags] = await Promise.all([
                idbGetAll(db, BACKEND_META_STORE),
                idbGetAll(db, BACKEND_ARTISTS_STORE),
                idbGetAll(db, BACKEND_TRACKS_STORE),
                idbGetAll(db, BACKEND_RELEASES_STORE),
                idbGetAll(db, BACKEND_RELEASE_TRACKS_STORE),
                idbGetAll(db, BACKEND_ARTWORK_STORE),
                idbGetAll(db, BACKEND_RELEASE_ARTWORK_STORE),
                idbGetAll(db, BACKEND_RAW_TAGS_STORE)
            ]);
            const metaMap = new Map((metaRows || []).map((row) => [row.key, row.value]));
            if (metaMap.get('schema_version') !== BACKEND_SCHEMA_VERSION) {
                canonicalLibraryAlbums = [];
                canonicalLibraryAlbumByIdentity.clear();
                canonicalLibraryAlbumByReleaseId.clear();
                canonicalLibraryCacheLoaded = true;
                canonicalLibraryCacheRevision = 0;
                canonicalLibraryCacheUpdatedAt = '';
                return;
            }
            materializeCanonicalLibraryCache({
                artists,
                tracks,
                releases,
                releaseTracks,
                artwork,
                releaseArtwork,
                rawTags
            }, {
                revision: metaMap.get('library_revision'),
                updatedAt: metaMap.get('updated_at')
            });
        } catch (e) {
            console.warn('[Auralis] canonical backend hydration failed:', reason, e);
        } finally {
            if (db) db.close();
        }
    }

    function scheduleCanonicalLibraryBackendHydration(reason = 'cache_read') {
        try { if (canonicalLibraryCacheLoaded) return Promise.resolve(canonicalLibraryAlbums); } catch (_) { return Promise.resolve([]); }
        if (canonicalLibraryCachePromise) return canonicalLibraryCachePromise;
        canonicalLibraryCachePromise = hydrateCanonicalLibraryBackendCache(reason)
            .finally(() => {
                canonicalLibraryCachePromise = null;
            });
        return canonicalLibraryCachePromise;
    }

    function buildCanonicalLibraryBackendPayload() {
        const sourceRows = [];
        const sourceIdSet = new Set();
        (Array.isArray(mediaFolders) ? mediaFolders : []).forEach((folder) => {
            const sourceId = canonicalSourceId(folder);
            sourceIdSet.add(sourceId);
            sourceRows.push({
                id: sourceId,
                kind: 'local_folder',
                rootUri: `folder://${folder.id || folder.name || 'unknown'}`,
                displayName: folder?.name || 'Local Folder',
                status: 'active',
                lastScanAt: folder?.lastScanned ? new Date(folder.lastScanned).toISOString() : ''
            });
        });
        if (!sourceIdSet.has(CANONICAL_CACHE_SOURCE_ID)) {
            sourceRows.push({
                id: CANONICAL_CACHE_SOURCE_ID,
                kind: 'local_cache',
                rootUri: 'cache://library',
                displayName: 'Cached Library',
                status: 'active',
                lastScanAt: ''
            });
        }

        const mediaFileRows = [];
        const mediaFileByHandle = new Map();
        const mediaFileByPath = new Map();
        (Array.isArray(scannedFiles) ? scannedFiles : []).forEach((file) => {
            const fileId = canonicalScannedFileId(file);
            if (!fileId) return;
            const relativePath = normalizeRelativeDir(file?.path || joinRelativeDir(file?.subDir, file?.name));
            const row = {
                id: fileId,
                sourceId: canonicalSourceId({ id: file?.folderId }),
                relativePath,
                sizeBytes: Number(file?.size || 0),
                mtimeMs: Number(file?.lastModified || 0),
                extension: String(file?.name || '').split('.').pop().toLowerCase(),
                contentHash: '',
                audioFingerprint: '',
                scanStatus: 'indexed'
            };
            mediaFileRows.push(row);
            if (file?.folderId && file?.subDir !== undefined && file?.name) {
                mediaFileByHandle.set(getHandleCacheKey(file.folderId, file.subDir, file.name), fileId);
            }
            if (relativePath) {
                mediaFileByPath.set(relativePath.toLowerCase(), fileId);
            }
        });

        const artistRows = new Map();
        const trackRows = new Map();
        const releaseRows = new Map();
        const releaseTrackRows = [];
        const artworkRows = new Map();
        const releaseArtworkRows = [];
        const rawTagRows = new Map();
        const releaseTrackIdByFileId = new Map();
        const releaseTrackIdByTrackKey = new Map();

        function ensureArtist(name) {
            const resolvedName = String(name || ARTIST_NAME).trim() || ARTIST_NAME;
            const id = canonicalArtistId(resolvedName);
            if (!artistRows.has(id)) {
                artistRows.set(id, {
                    id,
                    name: resolvedName,
                    sortName: resolvedName,
                    normalizedName: toArtistKey(resolvedName)
                });
            }
            return id;
        }

        function ensureVirtualMediaFile(track, album, ordinal) {
            const fileId = `file:virtual:${canonicalReleaseId(album)}:${ordinal}`;
            if (!mediaFileRows.some((row) => row.id === fileId)) {
                mediaFileRows.push({
                    id: fileId,
                    sourceId: CANONICAL_CACHE_SOURCE_ID,
                    relativePath: normalizeRelativeDir(track?.path || `${album?.title || 'album'}/${track?.title || ordinal}`),
                    sizeBytes: 0,
                    mtimeMs: 0,
                    extension: String(track?.ext || '').toLowerCase(),
                    contentHash: '',
                    audioFingerprint: '',
                    scanStatus: 'virtual'
                });
            }
            return fileId;
        }

        (Array.isArray(LIBRARY_ALBUMS) ? LIBRARY_ALBUMS : []).forEach((album) => {
            const releaseId = canonicalReleaseId(album);
            const albumArtistName = getAlbumPrimaryArtistName(album, album?.artist || ARTIST_NAME) || ARTIST_NAME;
            const albumArtistId = ensureArtist(albumArtistName);
            const orderedTracks = (Array.isArray(album?.tracks) ? album.tracks : []).slice().sort((a, b) =>
                Number(a?.discNo || 1) - Number(b?.discNo || 1)
                || Number(a?.no || 0) - Number(b?.no || 0)
            );

            releaseRows.set(releaseId, {
                id: releaseId,
                title: album?.title || 'Unknown Album',
                sortTitle: normalizeAlbumTitle(album?.title || 'Unknown Album'),
                normalizedTitle: albumKey(album?.title || 'Unknown Album'),
                albumArtistId,
                releaseYear: String(album?.year || '').trim(),
                releaseType: album?.isCompilation ? 'compilation' : 'album',
                sourceGroupKey: String(album?.id || '').trim(),
                trackCount: orderedTracks.length,
                totalDurationLabel: album?.totalDurationLabel || toLibraryDurationTotal(orderedTracks),
                payloadJson: JSON.stringify(toCanonicalReleasePayload(album))
            });

            if (album?.artUrl) {
                const artworkId = canonicalArtworkId(releaseId);
                artworkRows.set(artworkId, {
                    id: artworkId,
                    hash: String(album.artUrl),
                    mimeType: '',
                    width: 0,
                    height: 0,
                    storagePath: String(album.artUrl)
                });
                releaseArtworkRows.push({
                    id: `release_art:${releaseId}`,
                    releaseId,
                    artworkId
                });
            }

            orderedTracks.forEach((track, index) => {
                const displayArtistName = String(track?.artist || album?.artist || ARTIST_NAME).trim() || ARTIST_NAME;
                const displayArtistId = ensureArtist(displayArtistName);
                const trackId = canonicalTrackId(track, displayArtistName);
                if (!trackRows.has(trackId)) {
                    trackRows.set(trackId, {
                        id: trackId,
                        title: track?.title || `Track ${index + 1}`,
                        sortTitle: String(track?.title || `Track ${index + 1}`),
                        normalizedTitle: String(track?.title || `Track ${index + 1}`).trim().toLowerCase(),
                        canonicalArtistId: displayArtistId,
                        durationMs: Math.max(0, Math.round(Number(track?.durationSec || 0) * 1000)),
                        isrc: '',
                        fingerprint: ''
                    });
                }

                const relativePath = normalizeRelativeDir(track?.path || '');
                const fileId = (track?._handleKey && mediaFileByHandle.get(track._handleKey))
                    || (relativePath ? mediaFileByPath.get(relativePath.toLowerCase()) : '')
                    || ensureVirtualMediaFile(track, album, index + 1);
                const discNumber = Number(track?.discNo || 1) || 1;
                const trackNumber = Number(track?.no || index + 1) || (index + 1);
                const releaseTrackId = `${releaseId}::d${String(discNumber).padStart(2, '0')}::t${String(trackNumber).padStart(3, '0')}::${trackId}`;

                releaseTrackRows.push({
                    id: releaseTrackId,
                    releaseId,
                    trackId,
                    fileId,
                    discNumber,
                    trackNumber,
                    displayTitle: track?.title || `Track ${index + 1}`,
                    displayArtistId,
                    durationMs: Math.max(0, Math.round(Number(track?.durationSec || 0) * 1000)),
                    payloadJson: JSON.stringify(toCanonicalReleaseTrackPayload(track, album))
                });
                releaseTrackIdByFileId.set(fileId, releaseTrackId);
                releaseTrackIdByTrackKey.set(`${trackKey(track?.title, displayArtistName)}::${albumKey(track?.albumTitle || album?.title || '')}`, releaseTrackId);

                if (!rawTagRows.has(fileId)) {
                    rawTagRows.set(fileId, {
                        id: `raw:${fileId}`,
                        fileId,
                        extractorVersion: STORAGE_VERSION,
                        title: track?.title || '',
                        artist: displayArtistName,
                        album: track?.albumTitle || album?.title || '',
                        albumArtist: track?.albumArtist || albumArtistName,
                        trackNumber,
                        trackTotal: orderedTracks.length,
                        discNumber,
                        discTotal: 0,
                        releaseYear: String(track?.year || album?.year || '').trim(),
                        genre: String(track?.genre || album?.genre || '').trim(),
                        durationMs: Math.max(0, Math.round(Number(track?.durationSec || 0) * 1000)),
                        payloadJson: JSON.stringify({
                            ext: track?.ext || '',
                            path: track?.path || '',
                            handleKey: track?._handleKey || '',
                            sourceAlbumId: track?._sourceAlbumId || getTrackSourceAlbumIdentity(track, album),
                            sourceAlbumTitle: track?._sourceAlbumTitle || getTrackSourceAlbumTitle(track, album?._sourceAlbumTitle || album?.title || ''),
                            embeddedAlbumTitle: track?._embeddedAlbumTitle || ''
                        }),
                        createdAt: new Date().toISOString()
                    });
                }
            });
        });

        const currentReleaseId = nowPlaying ? `release:${albumIdentityKey(nowPlaying.albumTitle || activeAlbumTitle, activeAlbumArtist || nowPlaying.artist || '')}` : '';
        const currentQueueTrackKey = nowPlaying
            ? `${trackKey(nowPlaying.title, nowPlaying.artist)}::${albumKey(nowPlaying.albumTitle || activeAlbumTitle || '')}`
            : '';
        const currentReleaseTrackId = releaseTrackIdByTrackKey.get(currentQueueTrackKey) || '';
        const sessionRows = [{
            id: CANONICAL_SESSION_ID,
            deviceName: 'Auralis Local Device',
            currentReleaseId,
            currentReleaseTrackId,
            positionMs: 0,
            repeatMode: repeatMode || 'off',
            shuffleMode: false,
            queueRevision: Date.now(),
            updatedAt: new Date().toISOString()
        }];
        const queueRows = (Array.isArray(queueTracks) ? queueTracks : []).map((track, index) => {
            const queueKey = `${trackKey(track?.title, track?.artist)}::${albumKey(track?.albumTitle || '')}`;
            return {
                id: `queue:${CANONICAL_SESSION_ID}:${index}`,
                sessionId: CANONICAL_SESSION_ID,
                ordinal: index,
                releaseTrackId: releaseTrackIdByTrackKey.get(queueKey) || '',
                trackTitle: track?.title || '',
                trackArtist: track?.artist || '',
                albumTitle: track?.albumTitle || ''
            };
        });

        return {
            sources: sourceRows,
            files: mediaFileRows,
            rawTags: Array.from(rawTagRows.values()),
            artists: Array.from(artistRows.values()),
            tracks: Array.from(trackRows.values()),
            releases: Array.from(releaseRows.values()),
            releaseTracks: releaseTrackRows,
            artwork: Array.from(artworkRows.values()),
            releaseArtwork: releaseArtworkRows,
            sessions: sessionRows,
            queue: queueRows
        };
    }

    function replaceCanonicalLibraryBackend(db, payload, meta = {}) {
        const storeNames = [
            BACKEND_META_STORE,
            BACKEND_SOURCES_STORE,
            BACKEND_FILES_STORE,
            BACKEND_RAW_TAGS_STORE,
            BACKEND_ARTISTS_STORE,
            BACKEND_TRACKS_STORE,
            BACKEND_RELEASES_STORE,
            BACKEND_RELEASE_TRACKS_STORE,
            BACKEND_ARTWORK_STORE,
            BACKEND_RELEASE_ARTWORK_STORE,
            BACKEND_SESSIONS_STORE,
            BACKEND_QUEUE_STORE
        ];
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeNames, 'readwrite');
            tx.onerror = () => reject(tx.error);
            tx.oncomplete = () => resolve();

            [
                BACKEND_SOURCES_STORE,
                BACKEND_FILES_STORE,
                BACKEND_RAW_TAGS_STORE,
                BACKEND_ARTISTS_STORE,
                BACKEND_TRACKS_STORE,
                BACKEND_RELEASES_STORE,
                BACKEND_RELEASE_TRACKS_STORE,
                BACKEND_ARTWORK_STORE,
                BACKEND_RELEASE_ARTWORK_STORE,
                BACKEND_SESSIONS_STORE,
                BACKEND_QUEUE_STORE,
                BACKEND_META_STORE
            ].forEach((storeName) => tx.objectStore(storeName).clear());

            const putMany = (storeName, rows) => {
                const store = tx.objectStore(storeName);
                (Array.isArray(rows) ? rows : []).forEach((row) => store.put(row));
            };

            putMany(BACKEND_SOURCES_STORE, payload.sources);
            putMany(BACKEND_FILES_STORE, payload.files);
            putMany(BACKEND_RAW_TAGS_STORE, payload.rawTags);
            putMany(BACKEND_ARTISTS_STORE, payload.artists);
            putMany(BACKEND_TRACKS_STORE, payload.tracks);
            putMany(BACKEND_RELEASES_STORE, payload.releases);
            putMany(BACKEND_RELEASE_TRACKS_STORE, payload.releaseTracks);
            putMany(BACKEND_ARTWORK_STORE, payload.artwork);
            putMany(BACKEND_RELEASE_ARTWORK_STORE, payload.releaseArtwork);
            putMany(BACKEND_SESSIONS_STORE, payload.sessions);
            putMany(BACKEND_QUEUE_STORE, payload.queue);

            const metaStore = tx.objectStore(BACKEND_META_STORE);
            metaStore.put({ key: 'schema_version', value: BACKEND_SCHEMA_VERSION });
            metaStore.put({ key: 'library_revision', value: Number(meta.revision || 1) });
            metaStore.put({ key: 'last_sync_reason', value: String(meta.reason || 'unspecified') });
            metaStore.put({ key: 'updated_at', value: meta.updatedAt || new Date().toISOString() });
        });
    }

    async function syncCanonicalLibraryBackend(reason = 'library_snapshot') {
        let db;
        try {
            const payload = buildCanonicalLibraryBackendPayload();
            db = await openMediaDB();
            const revisionRecord = await idbGet(db, BACKEND_META_STORE, 'library_revision');
            const nextRevision = Math.max(0, Number(revisionRecord?.value || 0)) + 1;
            const updatedAt = new Date().toISOString();
            await replaceCanonicalLibraryBackend(db, payload, {
                revision: nextRevision,
                reason,
                updatedAt
            });
            materializeCanonicalLibraryCache(payload, { revision: nextRevision, updatedAt });
        } catch (e) {
            console.warn('[Auralis] canonical backend sync failed:', e);
        } finally {
            if (db) db.close();
        }
    }

    function scheduleCanonicalLibraryBackendSync(reason = 'library_snapshot') {
        canonicalLibrarySyncReason = reason;
        if (canonicalLibrarySyncTimer) return;
        canonicalLibrarySyncTimer = window.setTimeout(async () => {
            const syncReason = canonicalLibrarySyncReason || 'library_snapshot';
            canonicalLibrarySyncReason = '';
            canonicalLibrarySyncTimer = 0;
            await syncCanonicalLibraryBackend(syncReason);
        }, 120);
    }

    async function getCanonicalLibraryBackendSummary() {
        let db;
        try {
            db = await openMediaDB();
            const [meta, sources, files, artists, tracks, releases, releaseTracks, sessions, queue] = await Promise.all([
                idbGetAll(db, BACKEND_META_STORE),
                idbGetAll(db, BACKEND_SOURCES_STORE),
                idbGetAll(db, BACKEND_FILES_STORE),
                idbGetAll(db, BACKEND_ARTISTS_STORE),
                idbGetAll(db, BACKEND_TRACKS_STORE),
                idbGetAll(db, BACKEND_RELEASES_STORE),
                idbGetAll(db, BACKEND_RELEASE_TRACKS_STORE),
                idbGetAll(db, BACKEND_SESSIONS_STORE),
                idbGetAll(db, BACKEND_QUEUE_STORE)
            ]);
            const metaMap = new Map((meta || []).map((entry) => [entry.key, entry.value]));
            return {
                schemaVersion: metaMap.get('schema_version') || '',
                libraryRevision: Number(metaMap.get('library_revision') || 0),
                updatedAt: metaMap.get('updated_at') || '',
                counts: {
                    sources: (sources || []).length,
                    files: (files || []).length,
                    artists: (artists || []).length,
                    tracks: (tracks || []).length,
                    releases: (releases || []).length,
                    releaseTracks: (releaseTracks || []).length,
                    sessions: (sessions || []).length,
                    queueItems: (queue || []).length
                },
                currentSession: (sessions || [])[0] || null
            };
        } catch (e) {
            console.warn('[Auralis] canonical backend summary failed:', e);
            return null;
        } finally {
            if (db) db.close();
        }
    }

    function getCanonicalLibraryBackendCacheSummary() {
        return {
            loaded: canonicalLibraryCacheLoaded,
            revision: canonicalLibraryCacheRevision,
            updatedAt: canonicalLibraryCacheUpdatedAt,
            albumCount: canonicalLibraryAlbums.length
        };
    }

    // â”€â”€ Persistent album art cache â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    // Key format: lowercase "artist\0album" to deduplicate across sessions.
    function artCacheKey(artist, albumTitle) {
        return (String(artist || '').trim() + '\0' + String(albumTitle || '').trim()).toLowerCase();
    }

    // Retrieve cached artwork blob URL from IDB. Returns '' if not found.
    async function getCachedArt(artist, albumTitle) {
        const key = artCacheKey(artist, albumTitle);
        let db;
        try {
            db = await openMediaDB();
            const record = await idbGet(db, ART_STORE, key);
            if (record && record.blob) {
                return URL.createObjectURL(record.blob);
            }
        } catch (_) {} finally { if (db) db.close(); }
        return '';
    }

    // Persist artwork blob to IDB for future sessions.
    async function putCachedArt(artist, albumTitle, blob) {
        if (!blob) return;
        const key = artCacheKey(artist, albumTitle);
        let db;
        try {
            db = await openMediaDB();
            await idbPut(db, ART_STORE, { key, blob, ts: Date.now() });
        } catch (_) {} finally { if (db) db.close(); }
    }

    // Bulk-load all cached art keys (for quick "has art?" checks without per-album round-trips).
    async function loadArtCacheIndex() {
        let db;
        try {
            db = await openMediaDB();
            const all = await idbGetAll(db, ART_STORE);
            const map = new Map();
            for (const rec of all) {
                if (rec.key && rec.blob) map.set(rec.key, rec.blob);
            }
            return map;
        } catch (_) { return new Map(); } finally { if (db) db.close(); }
    }

    function toPersistedScannedFileRecord(file) {
        const normalized = {
            name: String(file?.name || ''),
            size: Number(file?.size || 0),
            type: String(file?.type || ''),
            lastModified: Number(file?.lastModified || 0),
            folderId: String(file?.folderId || ''),
            subDir: String(file?.subDir || '')
        };
        if (file?.path) normalized.path = String(file.path);
        return normalized;
    }

    async function rewritePersistedScannedFiles(files) {
        let db;
        try {
            db = await openMediaDB();
            await idbClearStore(db, FILES_STORE);
            for (const file of files) {
                await idbPut(db, FILES_STORE, toPersistedScannedFileRecord(file));
            }
        } catch (e) {
            console.warn('Failed to rewrite scanned file cache:', e);
        } finally {
            if (db) db.close();
        }
    }

    // â”€â”€ Check API support â”€â”€
