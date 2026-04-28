/*
 * Auralis JS shard: 05e-media-folder-picker.js
 * Purpose: native picker detection, input picker, cached files, folder storage
 * Generated from auralis-core.js. Edit this file, then run scripts/build-core.ps1.
 */

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
            try { URL.revokeObjectURL(url); } catch (_) { /* benign: cleanup */ }
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
            try { URL.revokeObjectURL(url); } catch (_) { /* benign: cleanup */ }
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

    function showConfirm(title, body, acceptLabel, callback) {
        const scrim = getEl('confirm-scrim');
        if (!scrim) return;
        const titleEl = getEl('confirm-title');
        const bodyEl = getEl('confirm-body');
        if (titleEl) titleEl.textContent = title;
        if (bodyEl) bodyEl.textContent = body;
        const acceptBtn = getEl('confirm-accept-btn');
        if (acceptBtn) acceptBtn.textContent = acceptLabel;
        confirmCallback = callback;
        scrim.classList.add('show');
        // Focus the cancel button for keyboard accessibility
        setTimeout(() => {
            const cancelBtn = scrim.querySelector('.confirm-cancel');
            if (cancelBtn) cancelBtn.focus();
        }, 50);
    }

    function confirmCancel() {
        const scrim = getEl('confirm-scrim');
        if (scrim) scrim.classList.remove('show');
        confirmCallback = null;
    }

    async function confirmAccept() {
        const scrim = getEl('confirm-scrim');
        if (scrim) scrim.classList.remove('show');
        if (confirmCallback) { const cb = confirmCallback; confirmCallback = null; await cb(); }
    }

    // Escape key dismisses confirm dialog
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && getEl('confirm-scrim')?.classList.contains('show')) {
            e.stopPropagation();
            confirmCancel();
        }
    });

    // â”€â”€ UI: Render setup folder list â”€â”€

    function createFolderIcon(className) {
        const icon = document.createElement('div');
        icon.className = className;
        icon.innerHTML = '<svg viewBox="0 0 24 24"><path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>';
        return icon;
    }

    function createSetupFolderEmptyHint() {
        const empty = document.createElement('div');
        empty.className = 'setup-folder-empty-hint';
        empty.appendChild(createFolderIcon(''));
        const copy = document.createElement('p');
        copy.appendChild(document.createTextNode('No folders added yet.'));
        copy.appendChild(document.createElement('br'));
        copy.appendChild(document.createTextNode('Tap below to browse.'));
        empty.appendChild(copy);
        return empty;
    }

    function createSetupFolderItem(folder) {
        const el = document.createElement('div');
        el.className = 'setup-folder-item selected';
        el.dataset.folderId = folder.id;
        el.dataset.action = 'toggleSetupFolder';
        el.tabIndex = 0;
        el.setAttribute('role', 'checkbox');
        el.setAttribute('aria-checked', 'true');
        el.setAttribute('aria-label', folder.name);

        const info = document.createElement('div');
        info.className = 'folder-info';
        const title = document.createElement('h3');
        title.textContent = folder.name;
        const count = document.createElement('span');
        count.textContent = folder.fileCount > 0 ? `${folder.fileCount} audio files` : 'Not scanned yet';
        info.appendChild(title);
        info.appendChild(count);

        const check = document.createElement('div');
        check.className = 'folder-check';
        check.innerHTML = '<svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>';

        el.appendChild(createFolderIcon('folder-icon'));
        el.appendChild(info);
        el.appendChild(check);
        el.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggleSetupFolder(el);
            }
        });
        return el;
    }

    function createSettingsFolderItem(folder) {
        const el = document.createElement('div');
        el.className = 'settings-folder-item';
        el.dataset.folderId = folder.id;

        const failedCount = Number(folder.failedCount || 0);
        const fileCount = Number(folder.fileCount || 0);
        const countText = fileCount > 0
            ? `${fileCount} audio file${fileCount === 1 ? '' : 's'}${failedCount ? ` - ${failedCount} failed` : ''}`
            : (folder.lastScanned ? 'No audio files found' : 'Not scanned yet');
        const scanDate = folder.lastScanned
            ? ` Â· Scanned ${new Date(folder.lastScanned).toLocaleDateString()}`
            : '';

        const info = document.createElement('div');
        info.className = 'settings-folder-info';
        const title = document.createElement('h3');
        title.textContent = folder.name;
        const meta = document.createElement('span');
        meta.textContent = countText + scanDate;
        const status = document.createElement('div');
        status.className = 'settings-folder-status';
        const lastScanned = Number(folder.lastScanned || 0);
        status.textContent = lastScanned
            ? `Last scanned ${new Date(lastScanned).toLocaleDateString()}`
            : 'Ready to scan';
        info.appendChild(title);
        info.appendChild(meta);
        info.appendChild(status);

        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'settings-folder-remove';
        remove.dataset.action = 'removeSettingsFolder';
        remove.dataset.folderId = folder.id;
        remove.title = 'Remove folder';
        remove.setAttribute('aria-label', `Remove ${folder.name}`);
        remove.innerHTML = '<svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>';

        el.appendChild(createFolderIcon('settings-folder-icon'));
        el.appendChild(info);
        el.appendChild(remove);
        return el;
    }

    function renderSetupFolderList() {
        const list = getEl('setup-folder-list');
        if (!list) return;
        clearNodeChildren(list);
        if (mediaFolders.length === 0) {
            list.appendChild(createSetupFolderEmptyHint());
        } else {
            appendFragment(list, mediaFolders.map((folder) => createSetupFolderItem(folder)));
        }
        syncSetupConfirmBtn();
    }

