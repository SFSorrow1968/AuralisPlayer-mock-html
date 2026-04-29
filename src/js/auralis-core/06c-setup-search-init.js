/*
 * Auralis JS shard: 06c-setup-search-init.js
 * Purpose: accessibility pass, layer close, search binding, swipe gesture, init
 * Generated from auralis-core.js. Edit this file, then run scripts/build-core.ps1.
 */

    function ensureAccessibility() {
        const targets = document.querySelectorAll('div[onclick], .item-clickable, .media-card, .video-card, .icon-btn, .nav-item, .p-btn, .player-main-toggle, .player-context-chip, .filter-chip');
        targets.forEach(el => {
            const tag = el.tagName;
            const isNativeControl = tag === 'BUTTON' || tag === 'A' || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

            if (!el.hasAttribute('aria-label')) el.setAttribute('aria-label', inferAriaLabel(el));
            if (isNativeControl) return;

            if (!el.hasAttribute('role')) el.setAttribute('role', 'button');
            if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');

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
