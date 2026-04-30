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

    // Determine upfront whether native File System Access API is likely to work.
    // On file:// in Chrome, showDirectoryPicker exists and isSecureContext is true,
    // but the API still throws SecurityError. We detect this scenario and skip native.
    function shouldUseNativePicker() {
        if (typeof window.showDirectoryPicker !== 'function') return false;
        if (!window.isSecureContext) return false;
        // file:// pages in Chrome report isSecureContext = true but
        // showDirectoryPicker throws SecurityError. Avoid the native path.
        if (location.protocol === 'file:') return false;
        return true;
    }

    async function pickFolder() {
        const canFallback = hasFallbackFolderInput();
        console.log('[Auralis][FolderPicker] pickFolder: shouldUseNative=', shouldUseNativePicker(), 'canFallback=', canFallback);

        if (shouldUseNativePicker()) {
            try {
                const handle = await window.showDirectoryPicker({ mode: 'read' });
                const hasReadPermission = await verifyPermission(handle);
                if (!hasReadPermission) {
                    toast('Permission denied for ' + handle.name);
                    return null;
                }
                pickerPermissionGrantedHandles.add(handle);
                // Deduplicate: check if already added
                for (const existing of mediaFolders) {
                    if (existing.handle && await existing.handle.isSameEntry(handle)) {
                        toast('"' + handle.name + '" is already added');
                        return null;
                    }
                }
                return handle;
            } catch (e) {
                if (e.name === 'AbortError') {
                    return null;
                }
                console.warn('[Auralis] showDirectoryPicker failed:', e.name, e.message);
                toast('Could not access folder: ' + e.message);
                return null;
            }
        }

        // Fallback: <input type="file" webkitdirectory>
        // This path is reached synchronously from the click handler,
        // so user activation is still valid for input.click().
        if (canFallback) {
            console.log('[Auralis][FolderPicker] Using <input webkitdirectory> fallback');
            return pickFolderViaInput();
        }

        toast('Folder access is not supported in this browser. Use desktop Chrome, Edge, or Opera.');
        return null;
    }

    function pickFolderViaInput() {
        console.log('[Auralis][FolderPicker] pickFolderViaInput: creating hidden input and calling .click()');
        return new Promise((resolve) => {
            const input = document.createElement('input');
            input.type = 'file';
            input.webkitdirectory = true;
            input.multiple = true;
            // Use offscreen positioning instead of display:none â€” some browsers
            // silently ignore .click() on hidden inputs.
            input.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;opacity:0;';
            document.body.appendChild(input);
            console.log('[Auralis][FolderPicker] input appended to body, about to call input.click()');

            let resolved = false;

            input.addEventListener('change', () => {
                resolved = true;
                const files = Array.from(input.files || []);
                input.remove();
                if (files.length === 0) {
                    toast('No files selected');
                    resolve(null);
                    return;
                }
                // Derive folder name from webkitRelativePath (handle both / and \ separators)
                const firstPath = files[0].webkitRelativePath || '';
                const folderName = firstPath.split(/[\\\/]/)[0] || 'Selected Folder';
                // Check for duplicate by name
                const existing = mediaFolders.find(f => f.name === folderName);
                if (existing) {
                    toast('"' + folderName + '" is already added');
                    resolve(null);
                    return;
                }
                resolve({ name: folderName, _files: files, _fallback: true });
            });

            // Chrome 91+ fires 'cancel' event
            input.addEventListener('cancel', () => {
                if (!resolved) {
                    resolved = true;
                    input.remove();
                    resolve(null);
                }
            });

            input.click();
        });
    }

    // â”€â”€ Add a folder to the store â”€â”€

    async function addFolderFromHandle(handle) {
        const folder = {
            id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
            name: handle.name,
            handle: handle._fallback ? null : handle,
            fileCount: 0,
            lastScanned: null,
            _fallbackFiles: handle._fallback ? handle._files : null
        };
        mediaFolders.push(folder);
        let db;
        try {
            db = await openMediaDB();
            // Don't persist _fallbackFiles (File objects aren't serializable to IDB structured clone in all browsers)
            const storable = { id: folder.id, name: folder.name, handle: folder.handle, fileCount: folder.fileCount, lastScanned: folder.lastScanned };
            await idbPut(db, FOLDER_STORE, storable);
        } catch (e) {
            console.warn('IDB put failed:', e);
        } finally {
            if (db) db.close();
        }
        return folder;
    }

    function getCachedFilesForFolder(folderId) {
        return (Array.isArray(scannedFiles) ? scannedFiles : [])
            .filter(file => file && file.folderId === folderId)
            .map(toPersistedScannedFileRecord);
    }

    function folderHasLiveScanSource(folder) {
        return Boolean(
            folder?.handle ||
            (Array.isArray(folder?._fallbackFiles) && folder._fallbackFiles.length > 0)
        );
    }

    function toStorableFolder(folder) {
        return {
            id: folder.id,
            name: folder.name,
            handle: folder.handle || null,
            fileCount: Number(folder.fileCount || 0),
            failedCount: Number(folder.failedCount || 0),
            lastScanned: folder.lastScanned || null
        };
    }

    async function persistFolderScanResult(folder, files, existingDb = null) {
        const ownsDb = !existingDb;
        let db = existingDb;
        const normalizedFiles = (Array.isArray(files) ? files : []).map(toPersistedScannedFileRecord);
        folder.fileCount = normalizedFiles.length;
        folder.lastScanned = Date.now();
        try {
            if (!db) db = await openMediaDB();
            await idbClearByIndex(db, FILES_STORE, 'folderId', folder.id);
            for (const file of normalizedFiles) await idbPut(db, FILES_STORE, file);
            await idbPut(db, FOLDER_STORE, toStorableFolder(folder));
        } catch (e) {
            console.warn('[Auralis] Failed to persist folder scan result:', e);
        } finally {
            if (ownsDb && db) db.close();
        }
        scannedFiles = (Array.isArray(scannedFiles) ? scannedFiles : [])
            .filter(file => file.folderId !== folder.id)
            .concat(normalizedFiles);
        return normalizedFiles;
    }

    async function scanAndPersistFolder(folder, options = {}) {
        if (!folder) return [];
        const files = await scanFolder(folder, options.onProgress || null);
        const persisted = await persistFolderScanResult(folder, files);
        if (options.mergeLibrary) {
            await syncLibraryFromMediaState();
        }
        renderSettingsFolderList();
        syncEmptyState();
        return persisted;
    }

    // â”€â”€ Remove a folder from the store â”€â”€

    async function removeFolderById(folderId) {
        mediaFolders = mediaFolders.filter(f => f.id !== folderId);
        scannedFiles = scannedFiles.filter(f => f.folderId !== folderId);

        for (const url of blobUrlCache.values()) {
            try { URL.revokeObjectURL(url); } catch (_) {}
        }
        blobUrlCache.clear();
        fileHandleCache.clear();
        artHandleCache.clear();

        let db;
        try {
            db = await openMediaDB();
            await idbDelete(db, FOLDER_STORE, folderId);
            await idbClearByIndex(db, FILES_STORE, 'folderId', folderId);
        } catch (e) {
            console.warn('IDB delete failed:', e);
        } finally {
            if (db) db.close();
        }

        if (mediaFolders.length > 0) {
            await rebuildFileHandleCache();
        }
    }

    // â”€â”€ Full scan of all folders â”€â”€

    async function scanAllFolders(progressUI) {
        if (scanInProgress) return;
        scanInProgress = true;

        // Clear stale blob URLs on rescan
        for (const url of blobUrlCache.values()) {
            try { URL.revokeObjectURL(url); } catch (_) {}
        }
        blobUrlCache.clear();
        fileHandleCache.clear();
        artHandleCache.clear();

        const allFiles = [];
        let totalFound = 0;
        let foldersScanned = 0;
        const totalFolders = mediaFolders.length;

        let db;
        try {
            db = await openMediaDB();
        } catch (e) {
            console.warn('Could not open IDB for scan:', e);
            scanInProgress = false;
            return [];
        }

        try {
            for (const folder of mediaFolders) {
                let files = [];
                const hasLiveSource = folderHasLiveScanSource(folder);

                if (hasLiveSource) {
                    files = await scanFolder(folder, (count) => {
                        totalFound = allFiles.length + count;
                        if (progressUI) progressUI(totalFound, folder.name, foldersScanned, totalFolders);
                    });
                    await persistFolderScanResult(folder, files, db);
                } else {
                    files = getCachedFilesForFolder(folder.id);
                    if (files.length > 0) {
                        folder.fileCount = files.length;
                        console.warn('[Auralis] Keeping cached scan for "' + folder.name + '" because no live folder handle is available.');
                    } else {
                        files = await scanFolder(folder, (count) => {
                            totalFound = allFiles.length + count;
                            if (progressUI) progressUI(totalFound, folder.name, foldersScanned, totalFolders);
                        });
                        await persistFolderScanResult(folder, files, db);
                    }
                }

                allFiles.push(...files);
                foldersScanned++;
                if (progressUI) progressUI(allFiles.length, folder.name, foldersScanned, totalFolders);
            }
        } finally {
            if (db) db.close();
            scannedFiles = allFiles;
            scanInProgress = false;
        }

        return allFiles;
    }

    // â”€â”€ Confirm dialog â”€â”€
