    function focusFirstAction(root) {
        requestAnimationFrame(() => {
            const firstAction = root && root.querySelector(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            );
            if (firstAction && typeof firstAction.focus === 'function') {
                firstAction.focus();
            }
        });
    }

    // Settings: add folder
    async function addSettingsFolder() {
        console.log('[Auralis][FolderPicker] addSettingsFolder() called');
        const addBtn = document.querySelector('.settings-add-folder');
        const folder = await addFolderViaPicker({
            triggerEl: addBtn,
            scanAfterAdd: true,
            mergeAfterScan: true,
            onUnsupported: () => {
                renderSettingsFolderList();
            },
            onSelected: () => {
                renderSettingsFolderList();
            },
            onAdded: () => {
                renderSettingsFolderList();
            }
        });
        if (folder) {
            toast('"' + folder.name + '" indexed');
        }
    }

    function runSynchronousFallbackFolderPick(options = {}) {
        const trigger = options.triggerEl || null;
        if (trigger) {
            trigger.style.pointerEvents = 'none';
            trigger.style.opacity = '0.5';
        }

        // Must be invoked directly from a trusted click handler so input.click()
        // happens in the same task as user activation.
        const pickPromise = pickFolderViaInput();

        (async () => {
            try {
                const handle = await pickPromise;
                if (!handle) return;
                const folder = await addFolderFromHandle(handle);
                if (typeof options.onSelected === 'function') {
                    await options.onSelected(folder);
                }

                // IMPORTANT: For <input webkitdirectory> fallback folders, _fallbackFiles
                // (the File objects) only exist in this browser session. They cannot be
                // serialized to IndexedDB. If we defer scanning to "Scan Selected" / "Rescan",
                // a page reload in between will lose the File objects and the scan returns 0.
                // Fix: immediately scan the folder while File objects are still live, and
                // persist the resulting file records to IDB right now.
                if ((folder._fallbackFiles && folder._fallbackFiles.length > 0) || options.scanAfterAdd) {
                    console.log('[Auralis][FolderPicker] Auto-scanning fallback folder while File objects are live:', folder.name);
                    const files = await scanAndPersistFolder(folder, {
                        mergeLibrary: Boolean(options.mergeAfterScan)
                    });
                    console.log('[Auralis][FolderPicker] Auto-scan complete:', files.length, 'audio files indexed for', folder.name);
                }

                if (typeof options.onAdded === 'function') {
                    await options.onAdded(folder);
                }
            } catch (err) {
                console.error('[Auralis][FolderPicker] runSynchronousFallbackFolderPick error:', err);
                toast('Folder error: ' + (err.message || err));
            } finally {
                if (trigger) {
                    trigger.style.pointerEvents = 'auto';
                    trigger.style.opacity = '1';
                }
            }
        })();
    }

    function shouldUseSynchronousFallbackPicker() {
        return hasFallbackFolderInput() && !shouldUseNativePicker();
    }

    function initFolderPickerBindings() {
        const settingsAddBtn = document.querySelector('.settings-add-folder');
        console.log('[Auralis][FolderPicker] initFolderPickerBindings: settingsAddBtn=', settingsAddBtn, 'alreadyBound=', settingsAddBtn?.dataset.boundFolderPicker);
        if (settingsAddBtn && settingsAddBtn.dataset.boundFolderPicker !== '1') {
            settingsAddBtn.dataset.boundFolderPicker = '1';
            settingsAddBtn.addEventListener('click', (e) => {
                console.log('[Auralis][FolderPicker] Settings Add Folder CLICKED (direct binding)');
                e.preventDefault();
                e.stopPropagation();
                if (shouldUseSynchronousFallbackPicker()) {
                    console.log('[Auralis][FolderPicker] Settings Add Folder using synchronous fallback path');
                    runSynchronousFallbackFolderPick({
                        triggerEl: settingsAddBtn,
                        scanAfterAdd: true,
                        mergeAfterScan: true,
                        onSelected: () => {
                            renderSettingsFolderList();
                        },
                        onAdded: (folder) => {
                            renderSettingsFolderList();
                            if (folder) {
                                toast('"' + folder.name + '" indexed');
                            }
                        }
                    });
                    return;
                }
                addSettingsFolder();
            });
        }

        const setupAddBtn = getEl('setup-add-folder-btn');
        console.log('[Auralis][FolderPicker] initFolderPickerBindings: setupAddBtn=', setupAddBtn, 'alreadyBound=', setupAddBtn?.dataset.boundFolderPicker);
        if (setupAddBtn && setupAddBtn.dataset.boundFolderPicker !== '1') {
            setupAddBtn.dataset.boundFolderPicker = '1';
            setupAddBtn.addEventListener('click', (e) => {
                console.log('[Auralis][FolderPicker] Setup Add Folder CLICKED (direct binding)');
                e.preventDefault();
                e.stopPropagation();
                if (shouldUseSynchronousFallbackPicker()) {
                    console.log('[Auralis][FolderPicker] Setup Add Folder using synchronous fallback path');
                    runSynchronousFallbackFolderPick({
                        triggerEl: setupAddBtn,
                        scanAfterAdd: true,
                        onSelected: () => {
                            renderSetupFolderList();
                        },
                        onAdded: () => {
                            renderSetupFolderList();
                        }
                    });
                    return;
                }
                addSetupFolder();
            });
        }

        console.log('[Auralis][FolderPicker] Environment: protocol=', location.protocol, 'isSecureContext=', window.isSecureContext, 'hasShowDirectoryPicker=', typeof window.showDirectoryPicker, 'shouldUseNative=', shouldUseNativePicker(), 'hasFallback=', hasFallbackFolderInput());
    }

    // Settings: remove folder (with confirm)
    function removeSettingsFolder(e, el) {
        e.stopPropagation();
        const folderId = el.dataset.folderId || el.closest('[data-folder-id]')?.dataset.folderId;
        if (!folderId) return;
        const folder = mediaFolders.find(f => f.id === folderId);
        const name = folder ? folder.name : 'this folder';
        const folderIndex = mediaFolders.findIndex(f => f.id === folderId);
        const removedFolder = folder ? { ...folder } : null;
        const removedFiles = scannedFiles
            .filter((file) => file.folderId === folderId)
            .map((file) => ({ ...file }));
        showConfirm(
            'Remove "' + name + '"?',
            'This will remove the folder and its ' + (folder?.fileCount || 0) + ' indexed files from your library. No files will be deleted from your device.',
            'Remove',
            async () => {
                await removeFolderById(folderId);
                await syncLibraryFromMediaState();
                renderSettingsFolderList();
                presentUndoToast('"' + name + '" removed', 'Undo', async () => {
                    if (!removedFolder || mediaFolders.some((candidate) => candidate.id === folderId)) return;
                    mediaFolders.splice(Math.max(0, Math.min(folderIndex, mediaFolders.length)), 0, removedFolder);
                    scannedFiles = scannedFiles.filter((file) => file.folderId !== folderId).concat(removedFiles.map((file) => ({ ...file })));

                    let db;
                    try {
                        db = await openMediaDB();
                        const storable = {
                            id: removedFolder.id,
                            name: removedFolder.name,
                            handle: removedFolder.handle || null,
                            fileCount: removedFolder.fileCount || removedFiles.length,
                            lastScanned: removedFolder.lastScanned || null
                        };
                        await idbPut(db, FOLDER_STORE, storable);
                        await idbClearByIndex(db, FILES_STORE, 'folderId', folderId);
                        for (const file of removedFiles) await idbPut(db, FILES_STORE, file);
                    } catch (restoreError) {
                        console.warn('IDB folder restore failed:', restoreError);
                    } finally {
                        if (db) db.close();
                    }

                    if (mediaFolders.length > 0) await rebuildFileHandleCache();
                    await syncLibraryFromMediaState();
                    renderSettingsFolderList();
                });
            }
        );
    }

    // Settings: rescan all folders
    async function rescanFolders() {
        if (scanInProgress) return;
        if (mediaFolders.length === 0) {
            toast('Add a folder first');
            return;
        }

        const statusEl = getEl('settings-scan-status');
        const fillEl = getEl('settings-scan-fill');
        const labelEl = getEl('settings-scan-label');
        const countEl = getEl('settings-scan-count');
        const rescanBtn = getEl('settings-rescan-btn');
        if (statusEl) statusEl.style.display = 'block';
        if (rescanBtn) { rescanBtn.textContent = 'Scanning...'; rescanBtn.style.pointerEvents = 'none'; rescanBtn.style.opacity = '0.6'; }

        try {
            await scanAllFolders((totalFiles, folderName, done, total) => {
                const folderPct = total > 0 ? (done / total) * 90 : 0;
                const pct = Math.min(95, folderPct + 5);
                if (labelEl) labelEl.textContent = 'Scanning ' + folderName + '...';
                if (countEl) countEl.textContent = totalFiles + ' files';
                if (fillEl) fillEl.style.width = pct + '%';
            });
        } catch (e) {
            console.warn('Rescan error:', e);
        }

        if (fillEl) fillEl.style.width = '100%';
        if (labelEl) labelEl.textContent = 'Scan complete!';
        if (countEl) countEl.textContent = scannedFiles.length + ' audio files';
        if (rescanBtn) { rescanBtn.textContent = 'Scan Library'; rescanBtn.style.pointerEvents = 'auto'; rescanBtn.style.opacity = '1'; }

        // Build playable library entries from scanned files
        await mergeScannedIntoLibrary();
        renderSettingsFolderList();

        toast(scannedFiles.length + ' tracks added to your library');
        setTimeout(() => { if (statusEl) statusEl.style.display = 'none'; }, 2000);
    }

    // Long press (inline handler support)
