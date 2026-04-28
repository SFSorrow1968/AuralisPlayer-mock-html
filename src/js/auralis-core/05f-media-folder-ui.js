/*
 * Auralis JS shard: 05f-media-folder-ui.js
 * Purpose: folder UI helpers, confirm dialog, setup/settings folder list, sync state
 * Generated from auralis-core.js. Edit this file, then run scripts/build-core.ps1.
 */

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function syncSetupConfirmBtn() {
        const btn = getEl('setup-confirm-btn');
        if (!btn) return;
        const selected = document.querySelectorAll('#setup-folder-list .setup-folder-item.selected');
        if (selected.length > 0) {
            btn.disabled = false;
            btn.style.opacity = '1';
            btn.style.pointerEvents = 'auto';
        } else {
            btn.disabled = true;
            btn.style.opacity = '0.4';
            btn.style.pointerEvents = 'none';
        }
    }

    // â”€â”€ UI: Render settings folder list â”€â”€

    function renderSettingsFolderList() {
        const wrap = getEl('settings-media-folders');
        if (!wrap) return;
        // Remove all folder items (keep the add button and empty state)
        wrap.querySelectorAll('.settings-folder-item').forEach(el => el.remove());
        const addBtn = wrap.querySelector('.settings-add-folder');
        const emptyEl = getEl('settings-folder-empty');
        const unsupportedBanner = getEl('settings-api-unsupported');
        const unsupportedBannerText = getEl('settings-api-unsupported-text');
        const unsupportedMessage = getFolderAccessUnsupportedMessage();

        if (unsupportedBanner) {
            unsupportedBanner.style.display = unsupportedMessage ? 'flex' : 'none';
        }
        if (unsupportedBannerText && unsupportedMessage) {
            unsupportedBannerText.textContent = unsupportedMessage;
        }
        if (addBtn) {
            addBtn.classList.toggle('is-disabled', Boolean(unsupportedMessage));
            addBtn.setAttribute('aria-disabled', unsupportedMessage ? 'true' : 'false');
            addBtn.title = unsupportedMessage || 'Add music folder';
        }

        if (mediaFolders.length === 0) {
            if (emptyEl) emptyEl.style.display = 'block';
            if (emptyEl) {
                const messageEl = emptyEl.querySelector('p');
                if (messageEl) {
                    messageEl.textContent = unsupportedMessage || 'No folders added yet';
                    messageEl.style.color = unsupportedMessage ? 'var(--sys-warning)' : 'var(--text-tertiary)';
                }
            }
        } else {
            if (emptyEl) emptyEl.style.display = 'none';
            const fragment = document.createDocumentFragment();
            mediaFolders.forEach((folder) => fragment.appendChild(createSettingsFolderItem(folder)));
            if (addBtn) wrap.insertBefore(fragment, addBtn);
            else wrap.appendChild(fragment);
        }

        // Update rescan button state
        const rescanBtn = getEl('settings-rescan-btn');
        if (rescanBtn) {
            if (mediaFolders.length === 0 || scanInProgress) {
                rescanBtn.style.opacity = '0.4';
                rescanBtn.style.pointerEvents = 'none';
            } else {
                rescanBtn.style.opacity = '1';
                rescanBtn.style.pointerEvents = 'auto';
            }
        }

        // Update header with folder/file count
        const header = getEl('settings-media-header');
        if (header) {
            const totalFiles = scannedFiles.length;
            if (mediaFolders.length === 0) {
                header.textContent = 'Media Folders';
            } else {
                header.textContent = 'Media Folders (' + mediaFolders.length + ')' +
                    (totalFiles > 0 ? ' Â· ' + totalFiles + ' files' : '');
            }
        }

        updatePlaybackHealthWarnings();
    }

    // â”€â”€ UI: Sync empty state (driven by real data) â”€â”€

    function syncEmptyState() {
        const emptyState = getEl('home-empty-state');
        const sectionsRoot = getEl('home-sections-root');
        const addBtn = document.querySelector('#home-music-section > .add-section-btn[data-action="openAddHomeSection"]');
        if (!emptyState) return;

        const hasMedia = scannedFiles.length > 0 || (LIBRARY_TRACKS && LIBRARY_TRACKS.length > 0);

        if (!hasMedia && mediaFolders.length === 0) {
            emptyState.style.display = 'flex';
            if (sectionsRoot) sectionsRoot.style.display = 'none';
            if (addBtn) addBtn.style.display = 'none';
        } else {
            emptyState.style.display = 'none';
            if (sectionsRoot) sectionsRoot.style.display = '';
            if (addBtn) addBtn.style.display = addBtn.dataset.forceVisible === '1' ? 'flex' : '';
        }

        updatePlaybackHealthWarnings();
    }

    // â”€â”€ Action handlers â”€â”€

    function showFirstTimeSetup() {
        const setup = getEl('first-time-setup');
        if (!setup) return;

        // Check for API support
        const banner = getEl('setup-api-unsupported');
        const bannerText = banner ? banner.querySelector('span') : null;
        const addBtn = getEl('setup-add-folder-btn');
        const unsupportedMessage = getFolderAccessUnsupportedMessage();
        if (unsupportedMessage) {
            if (banner) banner.style.display = 'flex';
            if (bannerText) bannerText.textContent = unsupportedMessage;
            if (addBtn) { addBtn.style.opacity = '0.4'; addBtn.style.pointerEvents = 'none'; }
        } else {
            if (banner) banner.style.display = 'none';
            if (addBtn) { addBtn.style.opacity = '1'; addBtn.style.pointerEvents = 'auto'; }
        }

        // Reset scan progress UI
        const progress = getEl('setup-scan-progress');
        const fill = getEl('setup-scan-fill');
        const btn = getEl('setup-confirm-btn');
        if (progress) progress.style.display = 'none';
        if (fill) fill.style.width = '0%';
        if (btn) { btn.textContent = 'Scan Selected'; btn.style.pointerEvents = 'auto'; btn.style.opacity = '1'; }

        renderSetupFolderList();
        setup.style.display = 'flex';
        setTimeout(() => setup.classList.add('active'), 40);
    }

    function hideFirstTimeSetup() {
        const setup = getEl('first-time-setup');
        if (!setup) return;
        setup.classList.remove('active');
        setTimeout(() => {
            setup.style.display = 'none';
            syncBottomNavVisibility();
            syncEmptyState();
            renderSettingsFolderList();
        }, 500);
    }

    function toggleSetupFolder(el) {
        el.classList.toggle('selected');
        el.setAttribute('aria-checked', el.classList.contains('selected') ? 'true' : 'false');
        syncSetupConfirmBtn();
    }

    async function addFolderViaPicker(options = {}) {
        console.log('[Auralis][FolderPicker] addFolderViaPicker called');
        const unsupportedMessage = getFolderAccessUnsupportedMessage();
        console.log('[Auralis][FolderPicker] unsupportedMessage=', JSON.stringify(unsupportedMessage));
        if (unsupportedMessage) {
            toast(unsupportedMessage);
            if (typeof options.onUnsupported === 'function') options.onUnsupported();
            return null;
        }

        const trigger = options.triggerEl || null;
        if (trigger) {
            trigger.style.pointerEvents = 'none';
            trigger.style.opacity = '0.5';
        }

        try {
            console.log('[Auralis][FolderPicker] calling pickFolder()...');
            const handle = await pickFolder();
            console.log('[Auralis][FolderPicker] pickFolder returned:', handle);
            if (!handle) return null;
            const folder = await addFolderFromHandle(handle);
            if (typeof options.onSelected === 'function') await options.onSelected(folder);

            // Auto-scan fallback folders immediately while File objects are still live.
            // Settings also opts into immediate native-handle scanning so a chosen
            // folder appears in the library without requiring a second tap.
            if ((folder._fallbackFiles && folder._fallbackFiles.length > 0) || options.scanAfterAdd) {
                console.log('[Auralis][FolderPicker] Scanning newly added folder:', folder.name);
                const files = await scanAndPersistFolder(folder, {
                    mergeLibrary: Boolean(options.mergeAfterScan)
                });
                console.log('[Auralis][FolderPicker] Initial scan complete:', files.length, 'files for', folder.name);
            }

            if (typeof options.onAdded === 'function') await options.onAdded(folder);
            return folder;
        } catch (err) {
            console.error('[Auralis][FolderPicker] addFolderViaPicker error:', err);
            toast('Folder error: ' + (err.message || err));
            return null;
        } finally {
            if (trigger) {
                trigger.style.pointerEvents = 'auto';
                trigger.style.opacity = '1';
            }
        }
    }

    async function addSetupFolder() {
        const btn = getEl('setup-add-folder-btn');
        await addFolderViaPicker({
            triggerEl: btn,
            scanAfterAdd: true,
            onSelected: renderSetupFolderList,
            onAdded: renderSetupFolderList
        });
    }

    async function confirmSetup() {
        // Remove deselected folders
        const selectedIds = new Set();
        document.querySelectorAll('#setup-folder-list .setup-folder-item.selected').forEach(el => {
            selectedIds.add(el.dataset.folderId);
        });
        const toRemove = mediaFolders.filter(f => !selectedIds.has(f.id));
        for (const f of toRemove) await removeFolderById(f.id);

        if (mediaFolders.length === 0) {
            toast('Add at least one folder first');
            return;
        }

        safeStorage.setItem(SETUP_DONE_KEY, '1');

        // Show real scan progress
        const progress = getEl('setup-scan-progress');
        const fill = getEl('setup-scan-fill');
        const label = getEl('setup-scan-label');
        const count = getEl('setup-scan-count');
        const btn = getEl('setup-confirm-btn');
        if (progress) progress.style.display = 'block';
        if (btn) { btn.textContent = 'Scanning...'; btn.style.pointerEvents = 'none'; btn.style.opacity = '0.6'; }

        try {
            await scanAllFolders((totalFiles, folderName, done, total) => {
                const folderPct = total > 0 ? (done / total) * 80 : 0;
                const pct = Math.min(99, folderPct + 10);
                if (fill) fill.style.width = pct + '%';
                if (label) label.textContent = 'Scanning ' + folderName + '...';
                if (count) count.textContent = totalFiles + ' files found';
            });
        } catch (e) {
            console.warn('Scan error:', e);
            if (label) label.textContent = 'Scan error â€” some files may be missing';
            if (btn) { btn.textContent = 'Continue Anyway'; btn.style.pointerEvents = 'auto'; btn.style.opacity = '1'; }
            toast('Scan encountered an error: ' + (e.message || 'unknown'));
        }

        if (fill) fill.style.width = '100%';
        if (label) label.textContent = 'Scan complete!';
        if (count) count.textContent = scannedFiles.length + ' audio files indexed';

        // Build playable library entries from scanned files
        await mergeScannedIntoLibrary();

        toast(scannedFiles.length + ' tracks added to your library');
        setTimeout(() => hideFirstTimeSetup(), 800);
    }

    async function confirmSetupSmart() {
        const selectedIds = new Set();
        document.querySelectorAll('#setup-folder-list .setup-folder-item.selected').forEach(el => {
            selectedIds.add(el.dataset.folderId);
        });

        const allSelectedFallbackFolders = mediaFolders.length > 0
            && mediaFolders.every((folder) => selectedIds.has(folder.id))
            && mediaFolders.every((folder) => {
                const hasLiveFallbackFiles = Array.isArray(folder?._fallbackFiles) && folder._fallbackFiles.length > 0;
                if (!hasLiveFallbackFiles) return false;
                return scannedFiles.some((file) => file.folderId === folder.id);
            });

        if (!allSelectedFallbackFolders) {
            return confirmSetup();
        }

        const toRemove = mediaFolders.filter(f => !selectedIds.has(f.id));
        for (const f of toRemove) await removeFolderById(f.id);

        if (mediaFolders.length === 0) {
            toast('Add at least one folder first');
            return;
        }

        safeStorage.setItem(SETUP_DONE_KEY, '1');

        const progress = getEl('setup-scan-progress');
        const fill = getEl('setup-scan-fill');
        const label = getEl('setup-scan-label');
        const count = getEl('setup-scan-count');
        const btn = getEl('setup-confirm-btn');

        if (progress) progress.style.display = 'block';
        if (fill) fill.style.width = '100%';
        if (label) label.textContent = 'Using indexed folder contents...';
        if (count) count.textContent = scannedFiles.length + ' audio files indexed';
        if (btn) { btn.textContent = 'Scanning...'; btn.style.pointerEvents = 'none'; btn.style.opacity = '0.6'; }

        await mergeScannedIntoLibrary();

        if (label) label.textContent = 'Scan complete!';
        if (count) count.textContent = scannedFiles.length + ' audio files indexed';

        toast(scannedFiles.length + ' tracks added to your library');
        setTimeout(() => hideFirstTimeSetup(), 800);
    }

    function skipSetup() {
        safeStorage.setItem(SETUP_DONE_KEY, 'skipped');
        hideFirstTimeSetup();
    }

    function openMediaFolderSetup() {
        showFirstTimeSetup();
    }
