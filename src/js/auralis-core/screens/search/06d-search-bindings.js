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

    function activateSearchMode() {
        enterSearchMode();
        const input = getEl('search-input');
        if (input) input.focus({ preventScroll: true });
    }
    window.activateSearchMode = activateSearchMode;

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
        const searchBar = getEl('search-bar-container');

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
            searchModeActive = Boolean(searchModeActive || searchQuery || (searchFilters && !searchFilters.has('all')));
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
        if (restoredQuery && Array.isArray(restoredFilters) && restoredFilters.length) {
            searchFilters.clear();
            restoredFilters.forEach((filter) => searchFilters.add(filter));
            if (!searchFilters.size) searchFilters.add('all');
        } else if (!restoredQuery) {
            resetSearchFiltersToAll();
        }
        searchQuery = restoredQuery;
        input.value = restoredQuery;
        syncFilterChipsFromState();
        if (restoredQuery) {
            searchModeActive = true;
            renderSearchState();
        }

        input.addEventListener('focus', () => {
            enterSearchMode();
        });

        input.addEventListener('pointerdown', () => {
            enterSearchMode();
        });

        input.addEventListener('click', () => {
            enterSearchMode();
        });

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
            exitSearchMode();
        });

        if (searchBar && !searchBar.dataset.searchGestureBound) {
            searchBar.dataset.searchGestureBound = '1';
            let gestureStart = null;
            const interactiveGestureSelector = 'button, a, input, textarea, select, [contenteditable="true"]';

            searchBar.addEventListener('pointerdown', (event) => {
                if (event.target?.closest?.(interactiveGestureSelector)) return;
                gestureStart = {
                    x: event.clientX,
                    y: event.clientY,
                    time: Date.now()
                };
            });

            searchBar.addEventListener('pointerup', (event) => {
                if (!gestureStart) return;
                const dx = event.clientX - gestureStart.x;
                const dy = event.clientY - gestureStart.y;
                const elapsed = Date.now() - gestureStart.time;
                gestureStart = null;
                if (elapsed > 700 || Math.abs(dx) < 44 || Math.abs(dx) < Math.abs(dy) * 1.4) return;
                if (dx < 0) activateSearchMode();
                else if (searchModeActive && !String(searchQuery || '').trim()) exitSearchMode();
            });
        }

        if (!document.body.dataset.searchOutsideBound) {
            document.body.dataset.searchOutsideBound = '1';
            document.addEventListener('pointerdown', (event) => {
                if (!(typeof searchModeActive !== 'undefined' && searchModeActive)) return;
                if (activeId !== 'library') return;
                const target = event.target;
                if (!(target instanceof Element)) return;
                const keepSearchOpen = target.closest(
                    '#library .top-bar, #library-edit-toggle-btn, #search-bar-container, #library-nav-container, #search-results, #search-workspace-root, #mini-player, .mini-player, .mini-card, #mini-progress-track, #action-sheet, #sheet-scrim, .bottom-nav'
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
