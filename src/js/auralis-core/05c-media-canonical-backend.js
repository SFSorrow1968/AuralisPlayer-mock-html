/*
 * Auralis JS shard: 05c-media-canonical-backend.js
 * Purpose: canonical album meta lookup, backend payload build, backend replace
 * Generated from auralis-core.js. Edit this file, then run scripts/build-core.ps1.
 */

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

