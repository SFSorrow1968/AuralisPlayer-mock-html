/*
 * Auralis JS shard: 05b-media-mp4-idb.js
 * Purpose: MP4 metadata parser, MediaDB open, IDB helpers, canonical IDs, payload
 * Generated from auralis-core.js. Edit this file, then run scripts/build-core.ps1.
 */

    /**
     * Parse M4A/MP4 metadata (iTunes ilst atoms).
     * Enough to get title, artist, album, year, genre, track #, and cover art.
     */
    function parseMP4Meta(bytes) {
        const result = { title: '', artist: '', album: '', year: '', genre: '', trackNo: 0, albumArtist: '', discNo: 0 };
        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

        function readUint32(offset) { try { return view.getUint32(offset, false); } catch (_) { return 0; } }
        function readStr(start, len) { return new TextDecoder('utf-8').decode(bytes.subarray(start, start + len)).trim(); }

        function walkAtoms(start, end, depth) {
            let pos = start;
            while (pos + 8 <= end) {
                const size = readUint32(pos);
                if (size < 8 || pos + size > end) break;
                const name = readStr(pos + 4, 4);
                const dataStart = pos + 8;
                const dataEnd = pos + size;

                if (name === 'moov' || name === 'udta' || name === 'meta' || name === 'ilst') {
                    const skip = name === 'meta' ? 4 : 0; // meta has a 4-byte version/flags prefix
                    walkAtoms(dataStart + skip, dataEnd, depth + 1);
                } else if (name === '\xA9nam' || name === '\xA9ART' || name === '\xA9alb' || name === '\xA9day'
                        || name === '\xA9gen' || name === 'trkn' || name === 'covr' || name === 'aART' || name === 'disk') {
                    // Find 'data' child atom
                    let p = dataStart;
                    while (p + 8 <= dataEnd) {
                        const ds = readUint32(p);
                        const dn = readStr(p + 4, 4);
                        if (dn === 'data' && ds >= 16) {
                            const type = readUint32(p + 8);
                            const val = bytes.subarray(p + 16, p + ds);
                            if (name === '\xA9nam') result.title  = result.title  || new TextDecoder('utf-8').decode(val).trim();
                            if (name === '\xA9ART') result.artist = result.artist || new TextDecoder('utf-8').decode(val).trim();
                            if (name === '\xA9alb') result.album  = result.album  || new TextDecoder('utf-8').decode(val).trim();
                            if (name === '\xA9day') result.year   = result.year   || new TextDecoder('utf-8').decode(val).trim().slice(0, 4);
                            if (name === '\xA9gen') result.genre  = result.genre  || new TextDecoder('utf-8').decode(val).trim();
                            if (name === 'trkn' && val.length >= 4) result.trackNo = (val[2] << 8) | val[3];
                            if (name === 'disk' && val.length >= 4) result.discNo = (val[2] << 8) | val[3];
                            if (name === 'aART') result.albumArtist = result.albumArtist || new TextDecoder('utf-8').decode(val).trim();
                            if (name === 'covr' && !result._pictureData) {
                                result._pictureMime = type === 13 ? 'image/jpeg' : 'image/png';
                                result._pictureData = val.slice();
                            }
                        }
                        p += Math.max(8, ds);
                    }
                }
                pos += size;
            }
        }
        walkAtoms(0, bytes.length, 0);
        return result;
    }

    /**
     * Standard ID3v1 genre list (abbreviated â€” first 80 entries cover most common genres).
     */
    const ID3_GENRES = [
        'Blues','Classic Rock','Country','Dance','Disco','Funk','Grunge','Hip-Hop',
        'Jazz','Metal','New Age','Oldies','Other','Pop','R&B','Rap','Reggae','Rock',
        'Techno','Industrial','Alternative','Ska','Death Metal','Pranks','Soundtrack',
        'Euro-Techno','Ambient','Trip-Hop','Vocal','Jazz+Funk','Fusion','Trance',
        'Classical','Instrumental','Acid','House','Game','Sound Clip','Gospel','Noise',
        'AlternRock','Bass','Soul','Punk','Space','Meditative','Instrumental Pop',
        'Instrumental Rock','Ethnic','Gothic','Darkwave','Techno-Industrial','Electronic',
        'Pop-Folk','Eurodance','Dream','Southern Rock','Comedy','Cult','Gangsta','Top 40',
        'Christian Rap','Pop/Funk','Jungle','Native American','Cabaret','New Wave',
        'Psychedelic','Rave','Showtunes','Trailer','Lo-Fi','Tribal','Acid Punk',
        'Acid Jazz','Polka','Retro','Musical','Rock & Roll','Hard Rock'
    ];
    const IDB_NAME = 'auralis_media_db';
    const IDB_VERSION = 3;
    const FOLDER_STORE = 'folders';
    const FILES_STORE = 'scanned_files';
    const ART_STORE = 'album_art';
    const BACKEND_META_STORE = 'backend_meta';
    const BACKEND_SOURCES_STORE = 'backend_media_sources';
    const BACKEND_FILES_STORE = 'backend_media_files';
    const BACKEND_RAW_TAGS_STORE = 'backend_raw_tag_snapshots';
    const BACKEND_ARTISTS_STORE = 'backend_artists';
    const BACKEND_TRACKS_STORE = 'backend_tracks';
    const BACKEND_RELEASES_STORE = 'backend_releases';
    const BACKEND_RELEASE_TRACKS_STORE = 'backend_release_tracks';
    const BACKEND_ARTWORK_STORE = 'backend_artwork_assets';
    const BACKEND_RELEASE_ARTWORK_STORE = 'backend_release_artwork';
    const BACKEND_SESSIONS_STORE = 'backend_playback_sessions';
    const BACKEND_QUEUE_STORE = 'backend_playback_queue';
    const BACKEND_SCHEMA_VERSION = '20260420_canonical_library_v2';
    const CANONICAL_CACHE_SOURCE_ID = 'source:cache-library';
    const CANONICAL_SESSION_ID = 'session:local-device';

    // In-memory state
    let mediaFolders = [];       // { id, name, handle, fileCount, lastScanned }
    let scannedFiles = [];       // { name, path, size, type, lastModified, folderId }
    let scanInProgress = false;
    let confirmCallback = null;
    let canonicalLibrarySyncTimer = 0;
    let canonicalLibrarySyncReason = '';
    let canonicalLibraryCachePromise = null;
    let canonicalLibraryCacheLoaded = false;
    let canonicalLibraryCacheRevision = 0;
    let canonicalLibraryCacheUpdatedAt = '';
    let canonicalLibraryAlbums = [];
    const canonicalLibraryAlbumByIdentity = new Map();
    const canonicalLibraryAlbumByReleaseId = new Map();
    const pickerPermissionGrantedHandles = new WeakSet();

    // â”€â”€ IndexedDB helpers â”€â”€

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

