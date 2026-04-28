/*
 * Auralis JS shard: 06-setup-init-a11y.js
 * Purpose: setup flow, dialogs, accessibility, boot/init
 * Generated from auralis-core.js. Edit this file, then run scripts/build-core.ps1.
 */

    // Overlay focus helper — moves focus to the first actionable control inside a
    // dialog or sheet, deferred one frame so CSS transitions don't fight focus.
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
    function startLongPress(e, title, sub) {
        clearLongPress();
        if (e && e.type === 'mousedown' && e.button !== 0) return;

        lpTimer = setTimeout(() => {
            markLongPressSuppressed(e?.currentTarget || e?.target || null);
            if (navigator.vibrate) navigator.vibrate(40);
            if (openInferredLongPressMenu(title, sub)) return;
            openSheet(title || 'Action Options', sub || 'Media Object');
        }, 600);
    }

    function clearLongPress() {
        if (lpTimer) {
            clearTimeout(lpTimer);
            lpTimer = null;
        }
    }
    // Queue behavior
    function moveQueueTrack(fromIndex, toIndex) {
        const from = Number(fromIndex);
        let to = Number(toIndex);
        if (!Number.isFinite(from) || !Number.isFinite(to)) return false;
        if (from < 0 || from >= queueTracks.length) return false;
        to = Math.max(0, Math.min(to, queueTracks.length - 1));
        if (from === to) return false;

        const currentIdx = getCurrentQueueIndex();
        const [moved] = queueTracks.splice(from, 1);
        queueTracks.splice(to, 0, moved);

        if (currentIdx === from) {
            queueIndex = to;
        } else if (from < currentIdx && to >= currentIdx) {
            queueIndex = Math.max(0, currentIdx - 1);
        } else if (from > currentIdx && to <= currentIdx) {
            queueIndex = Math.min(queueTracks.length - 1, currentIdx + 1);
        } else if (currentIdx >= 0) {
            queueIndex = currentIdx;
        }
        renderQueue();
        return true;
    }

    function moveQueueTrackNext(index) {
        const from = Number(index);
        if (!Number.isFinite(from)) return;
        const currentIdx = getCurrentQueueIndex();
        if (currentIdx < 0) {
            if (moveQueueTrack(from, 0)) {
                renderQueue();
                toast('Track moved to top of queue');
            }
            return;
        }
        if (from === currentIdx) {
            toast('Track is already playing');
            return;
        }
        const target = Math.min(currentIdx + 1, queueTracks.length - 1);
        if (moveQueueTrack(from, target)) {
            renderQueue();
            toast('Track will play next');
        } else {
            toast('Track is already next');
        }
    }

    function removeQueueTrack(index) {
        const idx = Number(index);
        if (!Number.isFinite(idx) || idx < 0 || idx >= queueTracks.length) return;

        const previousQueueTracks = queueTracks.slice();
        const previousQueueIndex = queueIndex;
        const previousNowPlaying = nowPlaying;
        const removed = queueTracks[idx];
        const currentIdx = getCurrentQueueIndex();
        const removingCurrent = idx === currentIdx;
        const engine = ensureAudioEngine();
        const wasPlaying = Boolean(isPlaying && engine && !engine.paused);

        const restoreRemovedTrack = () => {
            const shouldReload = Boolean(previousNowPlaying && !isSameTrack(nowPlaying, previousNowPlaying));
            queueTracks = previousQueueTracks.slice();
            queueIndex = Math.max(0, Math.min(previousQueueIndex, Math.max(0, queueTracks.length - 1)));
            if (previousNowPlaying) {
                setNowPlaying(previousNowPlaying, false);
                queueIndex = Math.max(0, Math.min(previousQueueIndex, Math.max(0, queueTracks.length - 1)));
                if (shouldReload) loadTrackIntoEngine(previousNowPlaying, wasPlaying, true);
                else setPlayButtonState(wasPlaying);
            } else {
                clearNowPlayingState();
                setPlayButtonState(false);
            }
            commitQueueChange();
            syncTrackActiveStates();
        };

        queueTracks.splice(idx, 1);
        if (!queueTracks.length) {
            queueIndex = 0;
            if (removingCurrent && engine) {
                engine.pause();
                setPlayButtonState(false);
            }
            commitQueueChange();
            presentUndoToast('Queue is now empty', 'Undo', restoreRemovedTrack);
            return;
        }

        if (removingCurrent) {
            const nextIdx = Math.min(idx, queueTracks.length - 1);
            const nextTrack = queueTracks[nextIdx];
            queueIndex = nextIdx;
            if (nextTrack) {
                setNowPlaying(nextTrack, true);
                loadTrackIntoEngine(nextTrack, wasPlaying, true);
            }
        } else if (idx < currentIdx) {
            queueIndex = Math.max(0, currentIdx - 1);
        }

        commitQueueChange();
        presentUndoToast(`Removed "${removed?.title || 'track'}"`, 'Undo', restoreRemovedTrack);
    }

    function shuffleQueueUpNext() {
        if (!shuffleQueueOrder()) {
            toast('Not enough tracks to shuffle');
            return;
        }
        renderQueue();
        toast('Queue order shuffled');
    }

    function openQueueTrackMenu(track, index) {
        if (!track) return;
        showZenithActionSheet(
            track.title || 'Queue Track',
            `${track.artist || ARTIST_NAME} - ${track.albumTitle || 'Single'} - ${track.duration || '--:--'}`,
            [
                {
                    label: 'Play Now',
                    description: 'Jump to this track immediately.',
                    icon: 'music',
                    onSelect: () => playQueueTrackAt(index, true)
                },
                {
                    label: 'Move Next',
                    description: 'Place this track right after the current song.',
                    icon: 'next',
                    onSelect: () => moveQueueTrackNext(index)
                },
                {
                    label: 'Open Album',
                    description: track.albumTitle || 'Jump to source album.',
                    icon: 'album',
                    onSelect: () => routeToAlbumDetail(track.albumTitle, track.artist, getTrackSourceAlbumIdentity(track))
                },
                {
                    label: 'Remove From Queue',
                    description: 'Drop this track from the run list.',
                    icon: 'trash',
                    danger: true,
                    onSelect: () => removeQueueTrack(index)
                }
            ]
        );
    }

