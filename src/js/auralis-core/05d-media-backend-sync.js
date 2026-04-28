/*
 * Auralis JS shard: 05d-media-backend-sync.js
 * Purpose: backend sync scheduling, cache summary, art cache, file persistence
 * Generated from auralis-core.js. Edit this file, then run scripts/build-core.ps1.
 */

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
        } catch (_) { /* benign: cleanup */ } finally { if (db) db.close(); }
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
        } catch (_) { /* benign: cleanup */ } finally { if (db) db.close(); }
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

    function hasFileSystemAccess() {
        return typeof window.showDirectoryPicker === 'function' && window.isSecureContext;
    }

    function hasFallbackFolderInput() {
        const inp = document.createElement('input');
        return typeof inp.webkitdirectory !== 'undefined';
    }

    function getFolderAccessUnsupportedMessage() {
        // If native File System Access API is available and will work, no message needed
        if (shouldUseNativePicker()) return '';
        // If fallback <input webkitdirectory> works, no message needed either
        if (hasFallbackFolderInput()) return '';
        // Truly unsupported â€” no way to pick folders
        return 'This browser does not support folder access. Use desktop Chrome, Edge, or Opera.';
    }

    // â”€â”€ Load persisted folders from IDB on boot â”€â”€

    async function loadMediaFolders() {
        let db;
        try {
            db = await openMediaDB();
            mediaFolders = await idbGetAll(db, FOLDER_STORE);
            scannedFiles = await idbGetAll(db, FILES_STORE);
        } catch (e) {
            console.warn('Failed to load media folders from IndexedDB:', e);
            mediaFolders = [];
            scannedFiles = [];
        } finally {
            if (db) db.close();
        }

        // Prune stale fallback-only folders: added via <input webkitdirectory> in a
        // previous session with no native handle â€” their File objects are gone and
        // they can never be rescanned. Remove them so they don't silently produce
        // zero results on every scan.
        const scannedFileIdsInIDB = new Set((Array.isArray(scannedFiles) ? scannedFiles : []).map(f => f.folderId));
        const staleFallbackIds = mediaFolders
            .filter(f => !f.handle && !scannedFileIdsInIDB.has(f.id))
            .map(f => f.id);
        if (staleFallbackIds.length > 0) {
            console.warn('[Auralis] Pruning', staleFallbackIds.length, 'stale fallback folder(s) from IDB (no handle, no scanned files):', staleFallbackIds);
            let pruneDb;
            try {
                pruneDb = await openMediaDB();
                for (const id of staleFallbackIds) {
                    await idbDelete(pruneDb, FOLDER_STORE, id);
                }
            } catch (e) {
                console.warn('[Auralis] Failed to prune stale fallback folders:', e);
            } finally {
                if (pruneDb) pruneDb.close();
            }
            mediaFolders = mediaFolders.filter(f => !staleFallbackIds.includes(f.id));
        }

        const activeFolderIds = new Set(mediaFolders.map(folder => folder.id));
        const normalizedFiles = (Array.isArray(scannedFiles) ? scannedFiles : [])
            .map(toPersistedScannedFileRecord)
            .filter(file => file.folderId && activeFolderIds.has(file.folderId));
        if (normalizedFiles.length !== scannedFiles.length) {
            scannedFiles = normalizedFiles;
            await rewritePersistedScannedFiles(scannedFiles);
        } else {
            scannedFiles = normalizedFiles;
        }

        if (DEBUG) console.log('[Auralis] loadMediaFolders: mediaFolders=' + mediaFolders.length + ', scannedFiles=' + scannedFiles.length);

        // Also try to rebuild file handle cache for playback (needs permission)
        if (mediaFolders.length > 0) {
            await rebuildFileHandleCache();
        }

        await syncLibraryFromMediaState();
        void scheduleCanonicalLibraryBackendHydration('loadMediaFolders');
        updatePlaybackHealthWarnings();
    }

    // Re-walk stored folder handles to rebuild fileHandleCache without full rescan
    async function rebuildFileHandleCache() {
        for (const folder of mediaFolders) {
            if (!folder.handle) continue;
            try {
                const perm = await folder.handle.queryPermission({ mode: 'read' });
                if (perm !== 'granted') continue;
                await walkHandlesOnly(folder.handle, folder.id, '');
            } catch (e) {
                console.warn('Could not rebuild handles for', folder.name, e);
            }
        }
        if (DEBUG) console.log('[Auralis] rebuildFileHandleCache: rebuilt ' + fileHandleCache.size + ' handles');
        return fileHandleCache.size;
    }

    // Lightweight walk: only caches file handles, doesn't read file contents
    async function walkHandlesOnly(dirHandle, folderId, parentDir) {
        const dirPath = normalizeRelativeDir(parentDir);
        let fallbackImageEntry = null;
        try {
            for await (const entry of dirHandle.values()) {
                if (entry.kind === 'file') {
                    const ext = entry.name.split('.').pop().toLowerCase();
                    if (AUDIO_EXTENSIONS.has(ext)) {
                        const handleKey = getHandleCacheKey(folderId, dirPath, entry.name);
                        fileHandleCache.set(handleKey, entry);
                        if (!fileHandleCache.has(entry.name.toLowerCase())) fileHandleCache.set(entry.name.toLowerCase(), entry);
                    } else if (IMAGE_EXTENSIONS.has(ext)) {
                        const baseName = entry.name.replace(/\.[^.]+$/, '').toLowerCase();
                        const isArtFile = ART_FILENAME_PATTERNS.some(p => baseName.includes(p));
                        const artKey = getArtCacheKey(folderId, dirPath);
                        if (isArtFile && !artHandleCache.has(artKey)) {
                            artHandleCache.set(artKey, entry);
                        } else if (!fallbackImageEntry) {
                            fallbackImageEntry = entry;
                        }
                    }
                } else if (entry.kind === 'directory') {
                    await walkHandlesOnly(entry, folderId, joinRelativeDir(dirPath, entry.name));
                }
            }
            // Fallback: use any image file in the directory if no named art was found
            const artKey = getArtCacheKey(folderId, dirPath);
            if (!artHandleCache.has(artKey) && fallbackImageEntry) {
                artHandleCache.set(artKey, fallbackImageEntry);
            }
        } catch (_) {
            // Silently skip inaccessible directories
        }
    }

    // â”€â”€ Recursive directory scan â”€â”€

    async function scanDirectoryHandle(dirHandle, folderId, onFileFound, parentDir) {
        const dirPath = normalizeRelativeDir(parentDir);
        let fallbackImageEntry = null;
        try {
        for await (const entry of dirHandle.values()) {
            if (entry.kind === 'file') {
                const ext = entry.name.split('.').pop().toLowerCase();
                if (AUDIO_EXTENSIONS.has(ext)) {
                    let file;
                    try { file = await entry.getFile(); } catch (_) { continue; }
                    if (!file) continue;
                    const record = {
                        name: file.name,
                        size: file.size,
                        type: file.type || ('audio/' + ext),
                        lastModified: file.lastModified,
                        folderId: folderId,
                        subDir: dirPath
                    };
                    // Cache the file handle for later playback resolution
                    const handleKey = getScannedFileHandleKey(record);
                    if (handleKey) fileHandleCache.set(handleKey, entry);
                    if (!fileHandleCache.has(file.name.toLowerCase())) fileHandleCache.set(file.name.toLowerCase(), entry);
                    if (onFileFound) onFileFound(record);
                } else if (IMAGE_EXTENSIONS.has(ext)) {
                    // Cache art image handle for this directory
                    const baseName = entry.name.replace(/\.[^.]+$/, '').toLowerCase();
                    const isArtFile = ART_FILENAME_PATTERNS.some(p => baseName.includes(p));
                    const artKey = getArtCacheKey(folderId, dirPath);
                    if (isArtFile && !artHandleCache.has(artKey)) {
                        artHandleCache.set(artKey, entry);
                    } else if (!fallbackImageEntry) {
                        fallbackImageEntry = entry;
                    }
                }
            } else if (entry.kind === 'directory') {
                await scanDirectoryHandle(entry, folderId, onFileFound, joinRelativeDir(dirPath, entry.name));
            }
        }
        // Fallback: use any image file in the directory if no named art was found
        const artKey = getArtCacheKey(folderId, dirPath);
        if (!artHandleCache.has(artKey) && fallbackImageEntry) {
            artHandleCache.set(artKey, fallbackImageEntry);
        }
        } catch (e) {
            console.warn('[Auralis] Error scanning directory "' + (dirPath || dirHandle.name) + '":', e);
        }
    }

    async function scanFolder(folder, onProgress) {
        // Fallback path: folder was added via <input webkitdirectory>
        if (folder._fallbackFiles && Array.isArray(folder._fallbackFiles)) {
            const files = [];
            for (const file of folder._fallbackFiles) {
                const ext = file.name.split('.').pop().toLowerCase();
                const relPath = file.webkitRelativePath || file.name;
                const parts = relPath.split(/[\\\/]/);
                const subDir = normalizeRelativeDir(parts.length > 1 ? parts.slice(1, -1).join('/') : '');

                // Cache sidecar image files for album art (cover.jpg, folder.jpeg, etc.)
                if (IMAGE_EXTENSIONS.has(ext)) {
                    const baseName = file.name.replace(/\.[^.]+$/, '').toLowerCase();
                    const isArtFile = ART_FILENAME_PATTERNS.some(p => baseName.includes(p));
                    const artKey = getArtCacheKey(folder.id, subDir);
                    if (isArtFile && !artHandleCache.has(artKey)) {
                        // Store a File-object shim in artHandleCache that supports .getFile()
                        const artBlobUrl = URL.createObjectURL(file);
                        artHandleCache.set(artKey, {
                            _file: file,
                            _blobUrl: artBlobUrl,
                            getFile: async () => file
                        });
                    } else if (!artHandleCache.has(getArtCacheKey(folder.id, subDir))) {
                        // Fallback: use any image if no named art pattern matched
                        const artBlobUrl = URL.createObjectURL(file);
                        artHandleCache.set(artKey, {
                            _file: file,
                            _blobUrl: artBlobUrl,
                            getFile: async () => file
                        });
                    }
                    continue; // not an audio file
                }

                if (!AUDIO_EXTENSIONS.has(ext)) continue;

                const record = {
                    name: file.name,
                    size: file.size,
                    type: file.type || ('audio/' + ext),
                    lastModified: file.lastModified,
                    folderId: folder.id,
                    subDir: subDir
                };
                // Cache a blob URL for playback and a getFile() shim so
                // mergeScannedIntoLibrary can read embedded metadata/artwork.
                const blobUrl = URL.createObjectURL(file);
                const cacheKey = getScannedFileHandleKey(record);
                const shimHandle = {
                    _blobUrl: blobUrl,
                    getFile: async () => file
                };
                if (cacheKey) {
                    fileHandleCache.set(cacheKey, shimHandle);
                    blobUrlCache.set(cacheKey, blobUrl);
                }
                if (!fileHandleCache.has(file.name.toLowerCase())) fileHandleCache.set(file.name.toLowerCase(), shimHandle);
                if (!blobUrlCache.has(file.name.toLowerCase())) blobUrlCache.set(file.name.toLowerCase(), blobUrl);
                files.push(record);
                if (onProgress) onProgress(files.length);
            }
            return files;
        }

        // Native File System Access path
        if (!folder.handle) {
            toast('Cannot scan "' + folder.name + '" â€” handle unavailable');
            return [];
        }
        const perm = pickerPermissionGrantedHandles.has(folder.handle) || await verifyPermission(folder.handle);
        if (!perm) {
            toast('Permission denied for ' + folder.name);
            return [];
        }
        const files = [];
        await scanDirectoryHandle(folder.handle, folder.id, (record) => {
            files.push(record);
            if (onProgress) onProgress(files.length);
        });
        return files;
    }

    async function verifyPermission(handle) {
        if (!handle || !handle.queryPermission) return false;
        let perm = await handle.queryPermission({ mode: 'read' });
        if (perm === 'granted') return true;
        try {
            perm = await handle.requestPermission({ mode: 'read' });
            return perm === 'granted';
        } catch (_) {
            return false;
        }
    }

    // â”€â”€ Pick a folder via browser dialog â”€â”€

