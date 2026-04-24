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
            persistQueue();
            renderQueue();
            syncTrackActiveStates();
        };

        queueTracks.splice(idx, 1);
        if (!queueTracks.length) {
            queueIndex = 0;
            if (removingCurrent && engine) {
                engine.pause();
                setPlayButtonState(false);
            }
            persistQueue();
            renderQueue();
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

        persistQueue();
        renderQueue();
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

    function clearQueue() {
        if (!queueTracks.length) {
            toast('Queue is already empty');
            renderQueue();
            return;
        }
        const previousQueueTracks = queueTracks.slice();
        const previousQueueIndex = queueIndex;
        const previousNowPlaying = nowPlaying;
        const engine = ensureAudioEngine();
        const wasPlaying = Boolean(isPlaying && engine && !engine.paused);

        const restoreClearedQueue = () => {
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
            persistQueue();
            renderQueue();
            syncTrackActiveStates();
        };

        const currentIdx = getCurrentQueueIndex();
        if (currentIdx >= 0 && queueTracks[currentIdx]) {
            const currentTrack = queueTracks[currentIdx];
            queueTracks = [currentTrack];
            queueIndex = 0;
            persistQueue();
            renderQueue();
            presentUndoToast('Cleared upcoming tracks', 'Undo', restoreClearedQueue);
            return;
        }
        queueTracks = [];
        queueIndex = 0;
        persistQueue();
        renderQueue();
        presentUndoToast('Queue cleared', 'Undo', restoreClearedQueue);
    }

    function addCurrentToQueue() {
        if (!nowPlaying) return;
        if (queueTracks.length >= MAX_QUEUE_SIZE) {
            toast(`Queue limit reached (${MAX_QUEUE_SIZE} tracks)`);
            return;
        }
        queueTracks.push(nowPlaying);
        renderQueue();
        toast(`Added "${nowPlaying.title}" to queue`);
    }

    function playCurrentNext() {
        if (!nowPlaying) return;
        const key = getTrackIdentityKey(nowPlaying);
        queueTracks = queueTracks.filter((track) => getTrackIdentityKey(track) !== key);
        const currentIdx = Math.max(0, getCurrentQueueIndex());
        queueTracks.splice(Math.min(currentIdx + 1, queueTracks.length), 0, nowPlaying);
        if (queueTracks.length > MAX_QUEUE_SIZE) queueTracks = queueTracks.slice(0, MAX_QUEUE_SIZE);
        renderQueue();
        toast(`"${nowPlaying.title}" will play next`);
    }

    function bindQueueInteractions() {
        const list = getEl('queue-list');
        if (!list || list.dataset.queueBound === '1') return;
        list.dataset.queueBound = '1';

        let dragSourceIndex = -1;
        let dragSourceRow = null;

        const clearDropMarkers = () => {
            list.querySelectorAll('.queue-row.queue-drop-before, .queue-row.queue-drop-after').forEach((row) => {
                row.classList.remove('queue-drop-before', 'queue-drop-after');
            });
        };

        list.addEventListener('dragstart', (evt) => {
            const handle = evt.target?.closest('.queue-drag-handle');
            const row = handle?.closest('.queue-row');
            if (!row || row.dataset.queueReorderable !== '1') {
                evt.preventDefault();
                return;
            }
            dragSourceRow = row;
            dragSourceIndex = Number(row.dataset.queueIndex);
            row.classList.add('is-dragging');
            if (evt.dataTransfer) {
                evt.dataTransfer.effectAllowed = 'move';
                evt.dataTransfer.setData('text/plain', String(dragSourceIndex));
            }
        });

        list.addEventListener('dragover', (evt) => {
            const row = evt.target?.closest('.queue-row');
            if (!row || row === dragSourceRow || !list.contains(row) || row.dataset.queueReorderable !== '1') return;
            evt.preventDefault();
            clearDropMarkers();
            const rect = row.getBoundingClientRect();
            const insertAfter = evt.clientY > (rect.top + rect.height / 2);
            row.classList.add(insertAfter ? 'queue-drop-after' : 'queue-drop-before');
        });

        list.addEventListener('drop', (evt) => {
            const row = evt.target?.closest('.queue-row');
            if (!row || row === dragSourceRow || dragSourceIndex < 0 || row.dataset.queueReorderable !== '1') return;
            evt.preventDefault();
            const targetIndex = Number(row.dataset.queueIndex);
            const rect = row.getBoundingClientRect();
            const insertAfter = evt.clientY > (rect.top + rect.height / 2);
            let nextIndex = targetIndex + (insertAfter ? 1 : 0);
            if (dragSourceIndex < nextIndex) nextIndex -= 1;
            if (moveQueueTrack(dragSourceIndex, nextIndex)) {
                queueDragSuppressUntil = Date.now() + 220;
                renderQueue();
            }
        });

        list.addEventListener('dragend', () => {
            clearDropMarkers();
            if (dragSourceRow) dragSourceRow.classList.remove('is-dragging');
            dragSourceRow = null;
            dragSourceIndex = -1;
        });

        let touchDrag = null;
        const cleanupTouchDrag = (applyMove) => {
            if (!touchDrag) return;
            const { row, ghost, placeholder, fromIndex } = touchDrag;
            if (ghost && ghost.parentNode) ghost.parentNode.removeChild(ghost);
            if (row) {
                row.style.visibility = '';
                row.classList.remove('is-dragging');
            }

            if (applyMove && placeholder && list.contains(placeholder)) {
                const previousRow = placeholder.previousElementSibling?.classList?.contains('queue-row')
                    ? placeholder.previousElementSibling
                    : null;
                const nextRow = placeholder.nextElementSibling?.classList?.contains('queue-row')
                    ? placeholder.nextElementSibling
                    : null;
                const nextIndexBeforeRemoval = nextRow
                    ? Number(nextRow.dataset.queueIndex)
                    : queueTracks.length;
                let toIndex = nextIndexBeforeRemoval;
                if (fromIndex < nextIndexBeforeRemoval) toIndex -= 1;
                if (!nextRow && previousRow && !Number.isFinite(toIndex)) {
                    toIndex = Number(previousRow.dataset.queueIndex);
                }
                if (moveQueueTrack(fromIndex, toIndex)) {
                    queueDragSuppressUntil = Date.now() + 220;
                    renderQueue();
                }
            }
            if (placeholder && placeholder.parentNode) placeholder.parentNode.removeChild(placeholder);
            touchDrag = null;
            clearDropMarkers();
        };

        list.addEventListener('pointerdown', (evt) => {
            if (evt.pointerType === 'mouse') return;
            const handle = evt.target?.closest('.queue-drag-handle');
            const row = handle?.closest('.queue-row');
            if (!row || !list.contains(row) || row.dataset.queueReorderable !== '1') return;
            const fromIndex = Number(row.dataset.queueIndex);
            if (!Number.isFinite(fromIndex)) return;
            evt.preventDefault();

            const rect = row.getBoundingClientRect();
            const ghost = row.cloneNode(true);
            ghost.classList.add('queue-drag-ghost');
            ghost.style.left = `${rect.left}px`;
            ghost.style.top = `${rect.top}px`;
            ghost.style.width = `${rect.width}px`;
            ghost.style.height = `${rect.height}px`;
            document.body.appendChild(ghost);

            const placeholder = document.createElement('div');
            placeholder.className = 'queue-drop-placeholder';
            placeholder.style.height = `${rect.height}px`;
            row.parentNode.insertBefore(placeholder, row.nextSibling);
            row.style.visibility = 'hidden';
            row.classList.add('is-dragging');

            touchDrag = {
                pointerId: evt.pointerId,
                row,
                ghost,
                placeholder,
                fromIndex,
                offsetY: evt.clientY - rect.top,
                offsetX: evt.clientX - rect.left
            };
        });

        list.addEventListener('pointermove', (evt) => {
            if (!touchDrag || touchDrag.pointerId !== evt.pointerId) return;
            evt.preventDefault();
            const { ghost, offsetY, offsetX, row, placeholder } = touchDrag;
            ghost.style.top = `${evt.clientY - offsetY}px`;
            ghost.style.left = `${evt.clientX - offsetX}px`;

            const over = document.elementFromPoint(evt.clientX, evt.clientY);
            const targetRow = over?.closest('.queue-row');
            if (targetRow && targetRow !== row && list.contains(targetRow) && targetRow.dataset.queueReorderable === '1') {
                const rect = targetRow.getBoundingClientRect();
                const insertAfter = evt.clientY > (rect.top + rect.height / 2);
                list.insertBefore(placeholder, insertAfter ? targetRow.nextSibling : targetRow);
            }

            const queueScreen = getEl('queue');
            if (queueScreen) {
                const bounds = queueScreen.getBoundingClientRect();
                const edge = 72;
                if (evt.clientY < bounds.top + edge) queueScreen.scrollTop -= 12;
                if (evt.clientY > bounds.bottom - edge) queueScreen.scrollTop += 12;
            }
        });

        list.addEventListener('pointerup', (evt) => {
            if (!touchDrag || touchDrag.pointerId !== evt.pointerId) return;
            cleanupTouchDrag(true);
        });
        list.addEventListener('pointercancel', (evt) => {
            if (!touchDrag || touchDrag.pointerId !== evt.pointerId) return;
            cleanupTouchDrag(false);
        });
    }

    // Drag + Drop
    function bindDragAndDrop(selector) {
        document.querySelectorAll(selector).forEach(el => {
            if (el.dataset.dragBound === '1') return;
            el.dataset.dragBound = '1';

            el.addEventListener('dragstart', (e) => {
                el.classList.add('dragging');
                if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
            });

            el.addEventListener('dragend', () => {
                el.classList.remove('dragging');
            });

            el.addEventListener('dragover', (e) => {
                e.preventDefault();
                if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
            });

            el.addEventListener('drop', (e) => {
                e.preventDefault();
                const dragging = el.parentElement?.querySelector('.dragging');
                if (!dragging || dragging === el) return;

                const parent = el.parentElement;
                const nodes = Array.from(parent.children);
                const dragIndex = nodes.indexOf(dragging);
                const targetIndex = nodes.indexOf(el);
                if (dragIndex < targetIndex) parent.insertBefore(dragging, el.nextSibling);
                else parent.insertBefore(dragging, el);

                if (navigator.vibrate) navigator.vibrate(20);
            });
        });
    }

    function bindTouchReorder(selector) {
        document.querySelectorAll(selector).forEach(el => {
            if (el.dataset.touchReorderBound === '1') return;
            el.dataset.touchReorderBound = '1';
        });

        let drag = null;

        const start = (point, target) => {
            const rect = target.getBoundingClientRect();

            const ghost = target.cloneNode(true);
            ghost.style.cssText = `position:fixed; left:${rect.left}px; top:${rect.top}px; width:${rect.width}px; opacity:0.85; z-index:3000; pointer-events:none; transform:scale(1.02);`;
            document.body.appendChild(ghost);

            const placeholder = document.createElement('div');
            placeholder.style.cssText = `width:${rect.width}px; height:${rect.height}px; border:2px dashed var(--sys-primary); border-radius:14px; margin:4px 0;`;

            target.style.opacity = '0.2';
            target.parentNode.insertBefore(placeholder, target.nextSibling);

            drag = {
                item: target,
                ghost,
                placeholder,
                offsetX: point.clientX - rect.left,
                offsetY: point.clientY - rect.top
            };
        };

        const move = (point) => {
            if (!drag) return;
            drag.ghost.style.left = `${point.clientX - drag.offsetX}px`;
            drag.ghost.style.top = `${point.clientY - drag.offsetY}px`;

            const parent = drag.item.parentNode;
            const siblings = Array.from(parent.querySelectorAll(selector)).filter(el => el !== drag.item);
            if (siblings.length === 0) return;

            let closest = null;
            let closestDist = Number.POSITIVE_INFINITY;
            siblings.forEach((sib) => {
                const r = sib.getBoundingClientRect();
                const cx = r.left + (r.width / 2);
                const cy = r.top + (r.height / 2);
                const dist = Math.hypot(point.clientX - cx, point.clientY - cy);
                if (dist < closestDist) {
                    closestDist = dist;
                    closest = sib;
                }
            });

            if (!closest) return;
            const cRect = closest.getBoundingClientRect();
            const insertAfter = point.clientY > cRect.top + (cRect.height / 2);
            parent.insertBefore(drag.placeholder, insertAfter ? closest.nextSibling : closest);
        };

        const end = () => {
            if (!drag) return;
            const { item, ghost, placeholder } = drag;
            if (placeholder.parentNode) placeholder.parentNode.insertBefore(item, placeholder);
            item.style.opacity = '1';
            placeholder.remove();
            ghost.remove();
            drag = null;
            if (navigator.vibrate) navigator.vibrate(20);
        };

        document.addEventListener('pointerdown', (e) => {
            if (e.pointerType === 'mouse') return;
            const target = e.target.closest(selector);
            if (!target || !target.draggable) return;
            start(e, target);
            e.preventDefault();
        });

        document.addEventListener('pointermove', (e) => {
            if (e.pointerType === 'mouse') return;
            move(e);
        });

        document.addEventListener('pointerup', end);
        document.addEventListener('pointercancel', end);

        document.addEventListener('touchstart', (e) => {
            const target = e.target.closest(selector);
            if (!target || !target.draggable) return;
            if (!e.touches || e.touches.length === 0) return;
            start(e.touches[0], target);
            e.preventDefault();
        }, { passive: false });

        document.addEventListener('touchmove', (e) => {
            if (!e.touches || e.touches.length === 0) return;
            move(Object.assign({}, e.touches[0], { target: e.target }));
            e.preventDefault();
        }, { passive: false });

        document.addEventListener('touchend', end, { passive: true });
        document.addEventListener('touchcancel', end, { passive: true });
    }

    // Accessibility
    function labelFromOnclick(onclickText) {
        if (!onclickText) return '';
        if (onclickText.includes('openSearchSort')) return 'Open sort options';
        if (onclickText.includes('openSidebar')) return 'Open sidebar';
        if (onclickText.includes('toggleOverlay')) return 'Open player';
        if (onclickText.includes('pop(')) return 'Back';
        if (onclickText.includes('startParty')) return 'Start party session';
        if (onclickText.includes('leaveParty')) return 'Leave party session';
        return '';
    }

    function inferAriaLabel(el) {
        const fromOnclick = labelFromOnclick(el.getAttribute('onclick'));
        if (fromOnclick) return fromOnclick;

        if (el.classList.contains('nav-item')) {
            const idx = Array.from(el.parentElement.children).indexOf(el);
            return ['Listen Now', 'Library', 'Queue'][idx] || 'Navigate';
        }

        const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
        return text || 'Activate control';
    }

    function updateStatusClock() {
        const clock = getEl('status-clock');
        if (!clock) return;
        clock.textContent = new Intl.DateTimeFormat([], {
            hour: 'numeric',
            minute: '2-digit'
        }).format(new Date());
    }

    function initStatusBarClock() {
        updateStatusClock();
        window.setInterval(updateStatusClock, 30000);
    }

    function syncSettingsToggles() {
        const settings = [
            { id: 'settings-dark-theme-toggle', value: darkThemeEnabled },
            { id: 'settings-hq-audio-toggle', value: hqAudioEnabled },
            { id: 'settings-gapless-toggle', value: gaplessEnabled }
        ];

        settings.forEach(({ id, value }) => {
            const toggle = getEl(id);
            if (!toggle) return;
            toggle.classList.toggle('active', Boolean(value));
            toggle.setAttribute('role', 'switch');
            toggle.setAttribute('aria-checked', String(Boolean(value)));
            if (!toggle.hasAttribute('tabindex')) toggle.setAttribute('tabindex', '0');
        });
    }

    function toggleSettingsPreference(setting) {
        const key = String(setting || '').trim();
        if (key === 'darkTheme') {
            darkThemeEnabled = !darkThemeEnabled;
            safeStorage.setItem(STORAGE_KEYS.darkTheme, darkThemeEnabled ? '1' : '0');
            syncSettingsToggles();
            toast(darkThemeEnabled ? 'Dark theme enabled' : 'Dark theme disabled');
            return;
        }
        if (key === 'hqAudio') {
            hqAudioEnabled = !hqAudioEnabled;
            safeStorage.setItem(STORAGE_KEYS.hqAudio, hqAudioEnabled ? '1' : '0');
            syncSettingsToggles();
            toast(hqAudioEnabled ? 'High quality audio enabled' : 'High quality audio disabled');
        }
    }

    function ensureAccessibility() {
        const targets = document.querySelectorAll('div[onclick], .item-clickable, .media-card, .video-card, .icon-btn, .nav-item, .p-btn, .filter-chip');
        targets.forEach(el => {
            const tag = el.tagName;
            if (tag === 'BUTTON' || tag === 'A' || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

            if (!el.hasAttribute('role')) el.setAttribute('role', 'button');
            if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
            if (!el.hasAttribute('aria-label')) el.setAttribute('aria-label', inferAriaLabel(el));

            if (el.dataset.kbBound !== '1') {
                el.dataset.kbBound = '1';
                el.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        el.click();
                    }
                });
            }
        });
    }

    // Esc / Layer handling
    function closeTopLayer() {
        if (albumArtViewerOpen || getEl('image-viewer-scrim')?.classList.contains('show')) {
            closeAlbumArtViewer();
            return true;
        }
        if (getEl('action-sheet').classList.contains('show')) {
            closeSheet();
            return true;
        }
        if (getEl('tag-creator').classList.contains('show')) {
            closeTagCreator();
            return true;
        }
        if (getEl('create-playlist-scrim')?.classList.contains('show')) {
            closeCreatePlaylistDialog();
            return true;
        }
        if (getEl('sidebar').classList.contains('show')) {
            closeSidebar();
            return true;
        }
        // Close EQ panel if visible (before closing the player overlay)
        const eqPanel = getEl('eq-panel');
        if (eqPanel && eqPanel.style.display !== 'none' && eqPanel.style.display !== '') {
            closeEq();
            return true;
        }
        if (activeId === 'queue') {
            pop();
            return true;
        }
        if (getEl('confirm-scrim')?.classList.contains('show')) {
            confirmCancel();
            return true;
        }
        if (getEl('player').classList.contains('active')) {
            toggleOverlay('player');
            return true;
        }
        if (isOnboardingVisible()) {
            dismissOnboarding();
            return true;
        }
        if (isSetupVisible()) {
            skipSetup();
            return true;
        }
        if (historyStack.length > 1) {
            pop();
            return true;
        }
        return false;
    }

    // Boot
    async function initOnboarding() {
        // Load persisted media folders from IndexedDB first
        await loadMediaFolders();

        const ob = getEl('onboarding');
        if (!ob) return;

        if (safeStorage.getItem(ONBOARDED_KEY) === '1') {
            ob.style.display = 'none';
            ob.classList.remove('active');
            // If onboarding done but setup not done, show setup
            if (safeStorage.getItem(SETUP_DONE_KEY) !== '1' && safeStorage.getItem(SETUP_DONE_KEY) !== 'skipped') {
                showFirstTimeSetup();
            } else {
                syncEmptyState();
                renderSettingsFolderList();
            }
        } else {
            ob.style.display = 'flex';
            setTimeout(() => ob.classList.add('active'), 40);
        }
    }

    let _searchDebounceTimer = null;
    let searchModeActive = false;

    function persistSearchUiState() {
        if (typeof setUiPreference !== 'function') return;
        setUiPreference('searchQuery', String(searchQuery || '').trim());
        const filters = searchFilters && typeof searchFilters.forEach === 'function'
            ? Array.from(searchFilters).filter(Boolean)
            : [];
        setUiPreference('searchFilters', filters.length ? filters : ['all']);
    }

    function enterSearchMode() {
        if (searchModeActive) return;
        searchModeActive = true;
        renderSearchState();
    }

    function exitSearchMode() {
        searchModeActive = false;
        const input = getEl('search-input');
        if (input) { input.value = ''; input.blur(); }
        searchQuery = '';
        if (typeof searchFilters !== 'undefined' && searchFilters && typeof searchFilters.clear === 'function') {
            searchFilters.clear();
            searchFilters.add('all');
        }
        persistSearchUiState();
        renderSearchState();
        window.exitSearchMode = exitSearchMode;
    }
    window.exitSearchMode = exitSearchMode;

    function initSearchBinding() {
        const input = getEl('search-input');
        if (!input) return;
        const clearBtn = getEl('search-clear-btn');

        const syncFilterChipsFromState = () => {
            if (typeof syncSearchFilterControls === 'function') {
                syncSearchFilterControls();
                return;
            }
            document.querySelectorAll('[data-filter]').forEach((chip) => {
                const filter = chip.dataset.filter;
                chip.classList.toggle('active', chip.classList.contains('filter-chip') && searchFilters.has(filter));
            });
        };

        const resetSearchFiltersToAll = () => {
            if (!searchFilters || typeof searchFilters.clear !== 'function') return;
            searchFilters.clear();
            searchFilters.add('all');
            syncFilterChipsFromState();
        };

        const queueSearchRender = (value) => {
            searchQuery = String(value || '').trim();
            if (!searchQuery) resetSearchFiltersToAll();
            persistSearchUiState();
            syncFilterChipsFromState();
            if (_searchDebounceTimer) clearTimeout(_searchDebounceTimer);
            _searchDebounceTimer = setTimeout(() => {
                _searchDebounceTimer = null;
                renderSearchState();
            }, 150);
        };

        const restoredQuery = String(getUiPreference('searchQuery', '') || '').trim();
        const restoredFilters = getUiPreference('searchFilters', []);
        if (Array.isArray(restoredFilters) && restoredFilters.length) {
            searchFilters.clear();
            restoredFilters.forEach((filter) => searchFilters.add(filter));
            if (!searchFilters.size) searchFilters.add('all');
        }
        searchQuery = restoredQuery;
        input.value = restoredQuery;
        syncFilterChipsFromState();
        if (restoredQuery) {
            searchModeActive = true;
            renderSearchState();
        }

        input.addEventListener('focus', () => enterSearchMode());

        input.addEventListener('input', (e) => {
            queueSearchRender(e.target.value);
        });

        input.addEventListener('search', (e) => {
            queueSearchRender(e.target.value);
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                rememberRecentSearch(input.value);
                persistSearchUiState();
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                exitSearchMode();
            }
        });

        clearBtn?.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            input.value = '';
            clearBtn.hidden = true;
            queueSearchRender('');
            renderSearchState();
            input.focus();
        });

        if (!document.body.dataset.searchOutsideBound) {
            document.body.dataset.searchOutsideBound = '1';
            document.addEventListener('pointerdown', (event) => {
                if (!(typeof searchModeActive !== 'undefined' && searchModeActive)) return;
                if (activeId !== 'library') return;
                const target = event.target;
                if (!(target instanceof Element)) return;
                const keepSearchOpen = target.closest(
                '#library .top-bar, #library-edit-toggle-btn, #search-bar-container, #library-nav-container, #search-tag-row, #search-results, #search-workspace-root, #mini-player, .mini-player, .mini-card, #mini-progress-track, #action-sheet, #sheet-scrim, .tag-creator, .bottom-nav'
            );
                if (keepSearchOpen) return;
                exitSearchMode();
            });
        }
    }

    function initClearQueueBinding() {
        bindQueueInteractions();
        renderQueue();
    }

    function initLongPressSuppressor() {
        document.addEventListener('click', (e) => {
            if (shouldSuppressLongPressClick(e.target)) {
                e.preventDefault();
                e.stopPropagation();
            }
        }, true);

        ['mouseup', 'mouseleave', 'touchend', 'touchcancel', 'scroll'].forEach(ev => {
            document.addEventListener(ev, clearLongPress, { passive: true });
        });
    }

    function initSwipeGesture() {
        const emu = document.querySelector('.emulator');
        if (!emu) return;

        let touchStartX = 0;
        let touchStartY = 0;
        let swiping = false;

        emu.addEventListener('touchstart', (e) => {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
            const rect = emu.getBoundingClientRect();
            swiping = (touchStartX - rect.left) < 40;
        }, { passive: true });

        emu.addEventListener('touchmove', (e) => {
            if (!swiping) return;
            const deltaX = e.touches[0].clientX - touchStartX;
            const deltaY = Math.abs(e.touches[0].clientY - touchStartY);
            if (deltaX > 60 && deltaY < 80) {
                openSidebar();
                swiping = false;
            }
        }, { passive: true });

        const edgeEl = getEl('swipe-edge');
        if (!edgeEl) return;

        let edgeStartX = 0;
        edgeEl.addEventListener('mousedown', (e) => {
            edgeStartX = e.clientX;
            e.preventDefault();

            const onMove = (ev) => {
                if (ev.clientX - edgeStartX > 50) {
                    openSidebar();
                    cleanup();
                }
            };

            const cleanup = () => {
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', cleanup);
            };

            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', cleanup);
        });

        edgeEl.addEventListener('touchstart', (e) => {
            edgeStartX = e.touches[0].clientX;
        }, { passive: true });

        edgeEl.addEventListener('touchmove', (e) => {
            if (e.touches[0].clientX - edgeStartX > 50) openSidebar();
        }, { passive: true });
    }

    function init() {
        // Spinner keyframes
        const st = document.createElement('style');
        st.innerHTML = '@keyframes spin { 100% { transform:rotate(360deg); } }';
        document.head.appendChild(st);

        clearDemoMarkup();
        hydrateLibraryData();
        initStatusBarClock();

        // Restore library cache and queue from previous session
        if (loadLibraryCache()) {
            renderHomeSections();
            renderLibraryViews();
        }
        restoreQueue();

        bindAudioEngine();
        renderLibraryViews();
        setNowPlaying(nowPlaying, false);
        updateProgressUI(0, nowPlaying?.durationSec || 0);
        scheduleNowPlayingMarquee(document);

        initOnboarding();
        initSearchBinding();
        initClearQueueBinding();
        initLongPressSuppressor();
        initFolderPickerBindings();

        bindDragAndDrop('#search-cat-grid .cat-card[draggable="true"]');
        bindDragAndDrop('#search-tag-row .filter-chip[draggable="true"]');
        bindTouchReorder('#search-cat-grid .cat-card[draggable="true"], #search-tag-row .filter-chip[draggable="true"]');

        ensureSortIndicators();
        renderSearchState();
        ensureAccessibility();

        syncSettingsToggles();
        const eqToggleBtn = getEl('eq-toggle-btn');
        if (eqToggleBtn) eqToggleBtn.classList.toggle('active', eqEnabled);

        document.addEventListener('keydown', (e) => {
            // Skip if user is typing in an input
            const tag = (e.target.tagName || '').toLowerCase();
            if (tag === 'input' || tag === 'textarea' || e.target.isContentEditable) {
                if (e.key === 'Escape') { closeTopLayer(); syncBottomNavVisibility(); }
                return;
            }
            if (e.key === 'Escape') {
                closeTopLayer();
                syncBottomNavVisibility();
                return;
            }
            // Space = toggle playback
            if (e.key === ' ' || e.code === 'Space') {
                e.preventDefault();
                togglePlayback(e);
                return;
            }
            // Arrow keys (no modifier)
            if (e.key === 'ArrowRight' && !e.ctrlKey && !e.metaKey) {
                e.preventDefault();
                const engine = ensureAudioEngine();
                if (engine) { engine.currentTime = Math.min(engine.duration || 0, engine.currentTime + 10); }
                return;
            }
            if (e.key === 'ArrowLeft' && !e.ctrlKey && !e.metaKey) {
                e.preventDefault();
                const engine = ensureAudioEngine();
                if (engine) { engine.currentTime = Math.max(0, engine.currentTime - 10); }
                return;
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                setVolume(currentVolume + 0.05);
                return;
            }
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setVolume(currentVolume - 0.05);
                return;
            }
            // N = next, P = previous
            if (e.key === 'n' || e.key === 'N') { playNext(); return; }
            if (e.key === 'p' || e.key === 'P') { playPrevious(); return; }
            // S = toggle shuffle
            if (e.key === 's' || e.key === 'S') { toggleShuffle(); return; }
            // R = cycle repeat
            if (e.key === 'r' || e.key === 'R') { toggleRepeatMode(); return; }
            // M = mute
            if (e.key === 'm' || e.key === 'M') { toggleMute(); return; }
            // / = focus search
            if (e.key === '/') {
                e.preventDefault();
                const searchInput = getEl('search-input');
                if (searchInput) searchInput.focus();
                return;
            }
        });

        const joinInput = getEl('join-code-input');
        if (joinInput) {
            joinInput.addEventListener('input', () => {
                joinInput.value = joinInput.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
                if (joinInput.value.length > 0) setJoinCodeError('');
            });
        }
